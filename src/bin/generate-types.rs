use gatha_transcribe::{
    create_router,
    messages::{ClientMessage, SessionState, PlaybackUpdate, PlaybackSpeedUpdate, VolumeUpdate, ServerMessage},
    db::Database,
    filestore::LocalFileStore,
    session_store::InMemorySessionStore,
    upload::AppState,
};
use ts_rs::TS;
use std::{fs, path::PathBuf, sync::Arc};

#[tokio::main]
async fn main() {
    println!("Generating TypeScript types from Rust structs...");
    ServerMessage::export().expect("Failed to export ServerMessage");
    SessionState::export().expect("Failed to export SessionState");
    PlaybackUpdate::export().expect("Failed to export PlaybackUpdate");
    PlaybackSpeedUpdate::export().expect("Failed to export PlaybackSpeedUpdate");
    VolumeUpdate::export().expect("Failed to export VolumeUpdate");
    ClientMessage::export().expect("Failed to export ClientMessage");
    println!("✓ TypeScript types generated in frontend/src/types/");

    println!("\nGenerating OpenAPI spec...");

    // Create minimal state for OpenAPI generation
    let db = Database::new("sqlite::memory:")
        .await
        .expect("Failed to create in-memory database");

    let filestore = LocalFileStore::new(PathBuf::from("temp"))
        .await
        .expect("Failed to create filestore");

    let session_store = InMemorySessionStore::new();

    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
        session_store: Arc::new(session_store),
    });

    let (_router, api) = create_router(state);
    let json = serde_json::to_string_pretty(&api).expect("Failed to serialize OpenAPI spec");
    fs::write("openapi.json", json).expect("Failed to write openapi.json");
    println!("✓ OpenAPI spec generated at openapi.json");

    println!("\n✓ All type generation complete!");
}
