use gatha_transcribe::create_router;

fn main() {
    let (_router, api) = create_router();

    let json = serde_json::to_string_pretty(&api).expect("Failed to serialize OpenAPI spec");
    println!("{}", json);
}
