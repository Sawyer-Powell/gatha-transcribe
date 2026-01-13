use axum::{
    extract::DefaultBodyLimit,
    response::{Html, IntoResponse},
    routing::get,
    Json, Router,
};
use std::{path::PathBuf, sync::Arc};
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};
use tower_cookies::CookieManagerLayer;
use tracing::info;
use utoipa_axum::{router::OpenApiRouter, routes};

pub mod messages;
pub mod filestore;
pub mod db;
pub mod upload;
pub mod auth;
pub mod session_store;
pub mod websocket;
pub mod error;
pub mod test_data;

use upload::AppState;

#[derive(utoipa::ToSchema, serde::Serialize, serde::Deserialize)]
pub struct User {
    pub name: String,
    pub id: u64,
}

#[utoipa::path(get, path = "/user", responses((status = OK, body = User)))]
#[axum::debug_handler]
async fn get_user() -> Json<User> {
    Json(User {
        name: "sawyer".into(),
        id: 56,
    })
}

/// Create router with optional frontend SPA serving
///
/// If `frontend_path` is provided, the router will serve the frontend application
/// with SPA routing (all non-API routes fall back to index.html).
///
/// If `frontend_path` is None, only API routes and WebSocket are served.
pub fn create_router(
    state: Arc<AppState>,
    frontend_path: Option<PathBuf>,
) -> (axum::Router, utoipa::openapi::OpenApi) {
    use tower_http::services::{ServeDir, ServeFile};

    let (api_router, api) = OpenApiRouter::new()
        .routes(routes!(get_user))
        .routes(routes!(upload::upload_video))
        .routes(routes!(upload::get_user_videos))
        .routes(routes!(upload::stream_video))
        .routes(routes!(auth::register))
        .routes(routes!(auth::login))
        .routes(routes!(auth::logout))
        .routes(routes!(auth::me))
        .split_for_parts();

    let mut router = Router::new()
        .merge(api_router)
        .route("/ws/{video_id}", get(crate::websocket::ws_handler));

    // Add frontend serving if path is provided
    if let Some(frontend_path) = frontend_path {
        // Serve static assets from /assets directory
        let assets_path = frontend_path.join("assets");
        let serve_assets = ServeDir::new(&assets_path);

        // Create SPA fallback handler that serves index.html
        let index_path = frontend_path.join("index.html");
        async fn spa_fallback(index_path: PathBuf) -> impl IntoResponse {
            match tokio::fs::read_to_string(&index_path).await {
                Ok(contents) => Html(contents).into_response(),
                Err(_) => (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to read index.html",
                )
                    .into_response(),
            }
        }
        let fallback_handler = {
            let index = index_path.clone();
            move || spa_fallback(index.clone())
        };

        // Serve vite.svg as a static file
        let vite_svg_path = frontend_path.join("vite.svg");
        let serve_vite_svg = ServeFile::new(vite_svg_path);

        router = router
            .nest_service("/assets", serve_assets)
            .route_service("/vite.svg", serve_vite_svg)
            .fallback(fallback_handler);
    }

    let router = router
        // CORS - must be before other middleware to handle preflight requests
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::AllowOrigin::predicate(
                    |origin: &axum::http::HeaderValue, _request_parts| {
                        origin.as_bytes().starts_with(b"http://localhost") ||
                        origin.as_bytes().starts_with(b"http://127.0.0.1")
                    }
                ))
                .allow_methods(vec![
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers(vec![
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::ACCEPT,
                    axum::http::header::RANGE,
                ])
                .allow_credentials(true) // Enable for cookies
        )
        // Cookie layer must come before request ID and tracing
        .layer(CookieManagerLayer::new())
        // Request ID generation and propagation
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .layer(PropagateRequestIdLayer::x_request_id())
        // HTTP request/response tracing
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|request: &axum::http::Request<_>| {
                    let request_id = request
                        .headers()
                        .get("x-request-id")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("unknown");

                    tracing::info_span!(
                        "http_request",
                        method = %request.method(),
                        uri = %request.uri(),
                        request_id = %request_id,
                    )
                })
                .on_response(|response: &axum::http::Response<_>, latency: std::time::Duration, _span: &tracing::Span| {
                    tracing::info!(
                        status = %response.status(),
                        latency_ms = %latency.as_millis(),
                        "request completed"
                    );
                }),
        )
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024 * 1024)) // 2GB limit
        .with_state(state);

    (router, api)
}

/// Spawn background task to persist sessions to database every 1 second
pub fn spawn_persistence_task(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));

        loop {
            interval.tick().await;

            // Get all sessions from memory
            let sessions = match state.session_store.list_all().await {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!(error = %e, "Failed to list sessions");
                    continue;
                }
            };

            // Collect only dirty sessions for persistence
            let mut dirty_sessions = Vec::new();
            let mut sessions_to_clean = Vec::new();

            for ((user_id, video_id), session) in sessions {
                if session.dirty {
                    match serde_json::to_string(&session) {
                        Ok(state_json) => {
                            dirty_sessions.push((user_id.clone(), video_id.clone(), state_json));
                            // Track which sessions to mark as clean
                            sessions_to_clean.push(((user_id, video_id), session));
                        }
                        Err(e) => {
                            tracing::error!(
                                user_id = %user_id,
                                video_id = %video_id,
                                error = %e,
                                "Failed to serialize session"
                            );
                        }
                    }
                }
            }

            if dirty_sessions.is_empty() {
                continue; // No dirty sessions, skip persistence
            }

            // Batch persist all dirty sessions
            if let Err(e) = state.db.upsert_sessions_batch(dirty_sessions.clone()).await {
                tracing::error!(
                    error = %e,
                    count = dirty_sessions.len(),
                    "Failed to batch persist sessions"
                );
                continue;
            }

            tracing::debug!(
                count = dirty_sessions.len(),
                "Batch persisted dirty sessions"
            );

            // Mark persisted sessions as clean
            for (key, mut session) in sessions_to_clean {
                session.dirty = false;
                if let Err(e) = state.session_store.set(&key, session).await {
                    tracing::warn!(
                        user_id = %key.0,
                        video_id = %key.1,
                        error = %e,
                        "Failed to mark session as clean"
                    );
                }
            }
        }
    });
}

/// Start the gatha-transcribe server
///
/// This function initializes all components (database, filestore, session store)
/// and starts the HTTP server on the specified port, serving both API and frontend.
///
/// Returns the server task handle and the app state.
pub async fn start_server(
    port: u16,
    database_url: Option<String>,
    filestore_path: Option<PathBuf>,
) -> Result<(tokio::task::JoinHandle<Result<(), std::io::Error>>, Arc<AppState>), Box<dyn std::error::Error>> {
    use db::Database;
    use filestore::LocalFileStore;
    use session_store::InMemorySessionStore;

    // Load environment variables if not provided
    dotenvy::dotenv().ok();

    let database_url = database_url.unwrap_or_else(|| {
        std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite:gatha.db".to_string())
    });

    let filestore_path = filestore_path.unwrap_or_else(|| {
        PathBuf::from(
            std::env::var("FILESTORE_PATH")
                .unwrap_or_else(|_| "test_filestore".to_string())
        )
    });

    // Determine frontend path
    let frontend_path = if let Ok(path) = std::env::var("FRONTEND_DIST_PATH") {
        PathBuf::from(path)
    } else {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        PathBuf::from(manifest_dir).join("frontend/dist")
    };

    // Verify frontend exists
    if !frontend_path.exists() {
        return Err(format!(
            "Frontend dist directory not found at: {:?}\nBuild the frontend first with: cd frontend && npm run build\nOr set FRONTEND_DIST_PATH environment variable",
            frontend_path
        ).into());
    }

    info!(path = ?frontend_path, "Serving frontend");

    // Initialize database
    info!(database_url = %database_url, "Connecting to database");
    let db = Database::new(&database_url).await?;

    // Run migrations
    info!("Running database migrations");
    db.run_migrations().await?;
    info!("Database migrations complete");

    // Initialize filestore
    info!(path = ?filestore_path, "Initializing filestore");
    let filestore = LocalFileStore::new(filestore_path).await?;
    info!("Filestore initialized");

    // Initialize session store
    info!("Initializing session store");
    let session_store = InMemorySessionStore::new();
    info!("Session store initialized");

    // Create app state
    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
        session_store: Arc::new(session_store),
    });

    // Spawn background persistence task
    info!("Spawning session persistence task");
    spawn_persistence_task(state.clone());

    let (router, _api) = create_router(state.clone(), Some(frontend_path));

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    let actual_addr = listener.local_addr()?;
    info!(%actual_addr, "Server listening");

    // Spawn server task
    let server_task = tokio::spawn(async move {
        axum::serve(listener, router).await
    });

    Ok((server_task, state))
}
