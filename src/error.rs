use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

/// Application-wide error type
#[derive(Error, Debug)]
pub enum AppError {
    // Client errors (4xx)
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation failed: {0}")]
    Validation(#[from] validator::ValidationErrors),

    // Server errors (5xx)
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("File storage error: {0}")]
    FileStore(#[from] crate::filestore::FileStoreError),

    #[error("Session store error: {0}")]
    SessionStore(#[from] crate::session_store::SessionStoreError),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("Password hashing error: {0}")]
    Bcrypt(#[from] bcrypt::BcryptError),

    #[error("Internal server error: {0}")]
    Internal(String),
}

impl AppError {
    /// Get HTTP status code for this error
    pub fn status_code(&self) -> StatusCode {
        match self {
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) | AppError::Jwt(_) => StatusCode::UNAUTHORIZED,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::Database(_)
            | AppError::FileStore(_)
            | AppError::SessionStore(_)
            | AppError::Bcrypt(_)
            | AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// Get user-friendly error message (hide implementation details for 5xx)
    pub fn user_message(&self) -> String {
        match self {
            // Client errors: show full details
            AppError::BadRequest(msg)
            | AppError::Unauthorized(msg)
            | AppError::NotFound(msg) => msg.clone(),

            AppError::Validation(e) => format!("Validation error: {}", e),

            // Server errors: hide details for security
            AppError::Database(_)
            | AppError::FileStore(_)
            | AppError::SessionStore(_)
            | AppError::Jwt(_)
            | AppError::Bcrypt(_)
            | AppError::Internal(_) => "Internal server error".to_string(),
        }
    }
}

/// JSON error response
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<String>,
}

/// Implement IntoResponse for automatic Axum integration
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();

        // Log full error for server errors (5xx)
        if status.is_server_error() {
            tracing::error!(
                error = %self,
                status = %status,
                "Request failed with server error"
            );
        }

        let body = Json(ErrorResponse {
            error: self.user_message(),
            details: if cfg!(debug_assertions) {
                // Include full error in development
                Some(self.to_string())
            } else {
                None
            },
        });

        (status, body).into_response()
    }
}
