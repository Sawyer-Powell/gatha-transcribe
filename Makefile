.PHONY: generate-types generate-client clean-spec db-setup db-reset

# Generate TypeScript types from Rust (both ts-rs types and OpenAPI client)
generate-types:
	@cargo run --bin generate-types
	@echo "\nGenerating TypeScript OpenAPI client..."
	@cd frontend && npx openapi-typescript ../openapi.json -o src/api/schema.ts
	@echo "✓ OpenAPI client generated at frontend/src/api/schema.ts"

bootstrap:
	@cd frontend && npm i && npm run build
	@cargo run --bin bootstrap
