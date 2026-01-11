use gatha_transcribe::create_router;

#[tokio::main]
async fn main() {
    let (router, _api) = create_router();

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    println!("Server listening on http://0.0.0.0:3000");

    axum::serve(listener, router).await.unwrap();
}
