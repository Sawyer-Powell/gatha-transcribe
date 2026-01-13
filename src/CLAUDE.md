# Backend Development

Rust/Axum API with SQLite database and streaming uploads.

## Development

```bash
cargo run                    # Start server (port 3000)
cargo run --bin test-server  # Test server with seed data
cargo nextest run            # Run tests
make db-setup                # Setup database
```

## Architecture

```
src/
├── lib.rs          # Router, middleware, server setup
├── auth.rs         # JWT + bcrypt authentication
├── upload.rs       # Streaming video uploads
├── db.rs           # Database layer (SQLx)
├── error.rs        # AppError with thiserror
├── websocket.rs    # Real-time transcription
├── session_store.rs # In-memory session store
├── test_data.rs    # Test data seeding
└── bin/
    ├── server.rs        # Production server
    └── test-server.rs   # Test server with seed data
```

## Key Modules

**`lib.rs`:**
- `create_router(state, frontend_path)` - Main router with optional frontend
- `spawn_persistence_task()` - Background session persistence
- `start_server()` - Server initialization

**`auth.rs`:**
- Bcrypt password hashing (DEFAULT_COST)
- JWT with 30-day expiration
- HTTP-only cookies with Secure flag in production

**`upload.rs`:**
- Streaming uploads via Axum Multipart
- Constant memory usage (~1-8 MB)
- 2GB max file size

**`error.rs`:**
- `AppError` enum with thiserror
- Auto-conversion from sqlx, bcrypt, validation errors
- User-friendly error messages

## Database

SQLite with SQLx migrations:
```bash
sqlx migrate add <name>      # Create migration
make db-setup                # Run migrations
cargo sqlx prepare           # Update offline data
```

## Testing

**Pattern:**
```rust
#[tokio::test]
async fn test_invariant() {
    let (state, _db_dir, _fs_dir) = create_test_state().await;
    let url = start_test_server(state).await;

    // Test invariant
    let response = client.get(&format!("{}/user", url)).send().await;
    assert_eq!(response.status(), 200);
}
```

**Helpers (tests/common/mod.rs):**
- `create_test_state()` - Temp database + filestore
- `start_test_server()` - Random port server
- `create_authenticated_client()` - Client with cookies

## Router Configuration

Serves both API and frontend (optional):
- API routes registered first (precedence)
- Static assets from `/assets`
- SPA fallback to `index.html`
- CORS, cookies, request tracing

## Security

- Bcrypt password hashing
- HTTP-only cookies
- JWT expiration
- Parameterized SQL queries
- Request size limits
