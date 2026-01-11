use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_cookies::{Cookie, Cookies};
use utoipa::ToSchema;
use validator::Validate;

use crate::{db::User, upload::AppState};

// JWT Claims structure
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // User ID
    pub exp: i64,    // Expiration timestamp
    pub iat: i64,    // Issued at
}

impl Claims {
    pub fn new(user_id: String) -> Self {
        let now = Utc::now();
        let exp = now + Duration::days(30);

        Self {
            sub: user_id,
            exp: exp.timestamp(),
            iat: now.timestamp(),
        }
    }
}

// Request/Response types
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct RegisterRequest {
    pub name: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthResponse {
    pub user: UserResponse,
    pub message: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserResponse {
    pub id: String,
    pub name: String,
    pub email: String,
}

// JWT secret from env
fn get_jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "CHANGE_ME_IN_PRODUCTION".to_string())
}

// Create JWT token
pub fn create_token(user_id: String) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = Claims::new(user_id);
    let secret = get_jwt_secret();

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

// Verify JWT token
pub fn verify_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let secret = get_jwt_secret();

    let validation = Validation::default();
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;

    Ok(token_data.claims)
}

// Hash password with bcrypt
pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    hash(password, DEFAULT_COST)
}

// Verify password against hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
    verify(password, hash)
}

/// Register a new user
#[utoipa::path(
    post,
    path = "/api/auth/register",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "User registered successfully", body = AuthResponse),
        (status = 400, description = "Invalid input or email already exists"),
        (status = 500, description = "Internal server error")
    ),
    tag = "auth"
)]
pub async fn register(
    State(state): State<Arc<AppState>>,
    cookies: Cookies,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Validate input
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Validation error: {}", e)))?;

    // Check if user exists
    if let Some(_) = state
        .db
        .get_user_by_email(&req.email)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        return Err((
            StatusCode::BAD_REQUEST,
            "Email already registered".to_string(),
        ));
    }

    // Hash password
    let hashed_password = hash_password(&req.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create user
    let user = User::new(req.name, req.email, hashed_password);

    // Insert into database
    state
        .db
        .insert_user(&user)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create JWT token
    let token = create_token(user.id.clone())
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Set HTTP-only cookie
    let mut cookie = Cookie::new("auth_token", token);
    cookie.set_http_only(true);
    cookie.set_path("/");
    cookie.set_max_age(tower_cookies::cookie::time::Duration::days(30));
    // Set secure flag in production
    if std::env::var("ENVIRONMENT").unwrap_or_default() == "production" {
        cookie.set_secure(true);
    }
    cookie.set_same_site(tower_cookies::cookie::SameSite::Lax);
    cookies.add(cookie);

    Ok((
        StatusCode::OK,
        Json(AuthResponse {
            user: UserResponse {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            message: "Registration successful".to_string(),
        }),
    ))
}

/// Login user
#[utoipa::path(
    post,
    path = "/api/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = AuthResponse),
        (status = 401, description = "Invalid credentials"),
        (status = 500, description = "Internal server error")
    ),
    tag = "auth"
)]
pub async fn login(
    State(state): State<Arc<AppState>>,
    cookies: Cookies,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Timing attack prevention: randomize delay between 50-200ms
    let delay_ms = rand::thread_rng().gen_range(50..200);
    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;

    // Validate input
    req.validate()
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Validation error: {}", e)))?;

    // Get user by email
    let user = state
        .db
        .get_user_by_email(&req.email)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    // Verify password
    let password_valid = verify_password(&req.password, &user.hashed_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !password_valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }

    // Create JWT token
    let token = create_token(user.id.clone())
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Set HTTP-only cookie
    let mut cookie = Cookie::new("auth_token", token);
    cookie.set_http_only(true);
    cookie.set_path("/");
    cookie.set_max_age(tower_cookies::cookie::time::Duration::days(30));
    if std::env::var("ENVIRONMENT").unwrap_or_default() == "production" {
        cookie.set_secure(true);
    }
    cookie.set_same_site(tower_cookies::cookie::SameSite::Lax);
    cookies.add(cookie);

    Ok((
        StatusCode::OK,
        Json(AuthResponse {
            user: UserResponse {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            message: "Login successful".to_string(),
        }),
    ))
}

/// Logout user
#[utoipa::path(
    post,
    path = "/api/auth/logout",
    responses(
        (status = 200, description = "Logout successful"),
    ),
    tag = "auth"
)]
pub async fn logout(cookies: Cookies) -> impl IntoResponse {
    // Remove cookie by setting expired cookie
    let mut cookie = Cookie::new("auth_token", "");
    cookie.set_http_only(true);
    cookie.set_path("/");
    cookie.set_max_age(tower_cookies::cookie::time::Duration::seconds(0));
    cookies.add(cookie);

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "message": "Logout successful"
        })),
    )
}

/// Get current user from token
#[utoipa::path(
    get,
    path = "/api/auth/me",
    responses(
        (status = 200, description = "Current user info", body = UserResponse),
        (status = 401, description = "Not authenticated"),
    ),
    tag = "auth"
)]
pub async fn me(
    State(state): State<Arc<AppState>>,
    cookies: Cookies,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Get token from cookie
    let token = cookies
        .get("auth_token")
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Not authenticated".to_string(),
        ))?
        .value()
        .to_string();

    // Verify token
    let claims = verify_token(&token)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;

    // Get user from database
    let user = state
        .db
        .get_user_by_id(&claims.sub)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::UNAUTHORIZED, "User not found".to_string()))?;

    Ok((
        StatusCode::OK,
        Json(UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
        }),
    ))
}

// Commented out for now - not needed since we use Cookies directly in handlers
// Can be re-added later if needed for route protection
// /// Authenticated user extractor for protected routes
// pub struct AuthUser {
//     pub user_id: String,
// }
//
// #[async_trait]
// impl<S> FromRequestParts<S> for AuthUser
// where
//     S: Send + Sync,
// {
//     type Rejection = (StatusCode, String);
//
//     async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
//         // Extract cookies from request
//         let cookies = parts
//             .extensions
//             .get::<Cookies>()
//             .ok_or((
//                 StatusCode::UNAUTHORIZED,
//                 "Not authenticated".to_string(),
//             ))?;
//
//         // Get token from cookie
//         let token = cookies
//             .get("auth_token")
//             .ok_or((
//                 StatusCode::UNAUTHORIZED,
//                 "Not authenticated".to_string(),
//             ))?
//             .value()
//             .to_string();
//
//         // Verify token
//         let claims = verify_token(&token)
//             .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;
//
//         Ok(AuthUser {
//             user_id: claims.sub,
//         })
//     }
// }
