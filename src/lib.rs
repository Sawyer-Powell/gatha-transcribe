use axum::{
    extract::{DefaultBodyLimit, ws::{Message, WebSocket, WebSocketUpgrade}},
    response::Response,
    routing::get,
    Json, Router,
};
use std::sync::Arc;
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};
use tower_cookies::CookieManagerLayer;
use utoipa_axum::{router::OpenApiRouter, routes};

pub mod messages;
pub mod filestore;
pub mod db;
pub mod upload;
pub mod auth;

use messages::ServerMessage;
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

async fn ws_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    // Send a test message every 2 seconds
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));

    loop {
        interval.tick().await;

        let msg = ServerMessage::TestMessage {
            text: "Hello from Rust!".to_string(),
        };

        let json = serde_json::to_string(&msg).unwrap();

        if socket.send(Message::Text(json.into())).await.is_err() {
            break;
        }
    }
}

pub fn create_router(state: Arc<AppState>) -> (axum::Router, utoipa::openapi::OpenApi) {
    let (api_router, api) = OpenApiRouter::new()
        .routes(routes!(get_user))
        .routes(routes!(upload::upload_video))
        .routes(routes!(auth::register))
        .routes(routes!(auth::login))
        .routes(routes!(auth::logout))
        .routes(routes!(auth::me))
        .split_for_parts();

    let router = Router::new()
        .merge(api_router)
        .route("/ws", get(ws_handler))
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
