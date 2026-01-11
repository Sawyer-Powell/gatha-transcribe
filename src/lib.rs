use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
    routing::get,
    Json, Router,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub mod messages;
pub mod filestore;
pub mod db;
use messages::ServerMessage;

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

pub fn create_router() -> (axum::Router, utoipa::openapi::OpenApi) {
    let (api_router, api) = OpenApiRouter::new()
        .routes(routes!(get_user))
        .split_for_parts();

    let router = Router::new()
        .merge(api_router)
        .route("/ws", get(ws_handler));

    (router, api)
}
