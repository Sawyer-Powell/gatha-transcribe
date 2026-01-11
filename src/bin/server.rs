use gatha_transcribe::start_server;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[tokio::main]
async fn main() {
    // Initialize tracing subscriber
    // Can be configured with RUST_LOG env var, defaults to info level
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"))
        )
        .with(
            fmt::layer()
                .with_target(true)
                .with_thread_ids(false)
                .with_level(true)
                .compact()
        )
        .init();

    info!("Starting gatha-transcribe server");

    // Start server on port 3000
    let (server_task, _state) = start_server(3000, None, None)
        .await
        .expect("Failed to start server");

    // Wait for server to complete
    server_task.await
        .expect("Server task panicked")
        .expect("Server failed");
}
