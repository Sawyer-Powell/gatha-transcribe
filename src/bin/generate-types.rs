use gatha_transcribe::{
    create_router,
    messages::ServerMessage,
    db::Database,
    filestore::LocalFileStore,
    upload::AppState,
};
use ts_rs::TS;
use std::{fs, path::PathBuf, sync::Arc};

#[tokio::main]
async fn main() {
    println!("Generating TypeScript types from Rust structs...");
    ServerMessage::export().expect("Failed to export ServerMessage");
    println!("✓ TypeScript types generated in frontend/src/types/");

    println!("\nGenerating OpenAPI spec...");

    // Create minimal state for OpenAPI generation
    let db = Database::new("sqlite::memory:")
        .await
        .expect("Failed to create in-memory database");

    let filestore = LocalFileStore::new(PathBuf::from("temp"))
        .await
        .expect("Failed to create filestore");

    let state = Arc::new(AppState {
        db,
        filestore: Arc::new(filestore),
    });

    let (_router, api) = create_router(state);
    let json = serde_json::to_string_pretty(&api).expect("Failed to serialize OpenAPI spec");
    fs::write("openapi.json", json).expect("Failed to write openapi.json");
    println!("✓ OpenAPI spec generated at openapi.json");

    println!("\n✓ All type generation complete!");
}
