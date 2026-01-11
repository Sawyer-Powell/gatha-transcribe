use gatha_transcribe::{create_router, messages::ServerMessage};
use ts_rs::TS;
use std::fs;

fn main() {
    println!("Generating TypeScript types from Rust structs...");
    ServerMessage::export().expect("Failed to export ServerMessage");
    println!("✓ TypeScript types generated in frontend/src/types/");

    println!("\nGenerating OpenAPI spec...");
    let (_router, api) = create_router();
    let json = serde_json::to_string_pretty(&api).expect("Failed to serialize OpenAPI spec");
    fs::write("openapi.json", json).expect("Failed to write openapi.json");
    println!("✓ OpenAPI spec generated at openapi.json");

    println!("\n✓ All type generation complete!");
}
