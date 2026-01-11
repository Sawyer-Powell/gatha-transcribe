use axum::Json;
use utoipa_axum::{router::OpenApiRouter, routes};

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

pub fn create_router() -> (axum::Router, utoipa::openapi::OpenApi) {
    let (router, api) = OpenApiRouter::new()
        .routes(routes!(get_user))
        .split_for_parts();

    (router, api)
}
