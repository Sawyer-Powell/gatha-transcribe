.PHONY: generate-client clean-spec

# Generate TypeScript client from OpenAPI spec
generate-client:
	@echo "Generating OpenAPI spec..."
	@cargo run --bin spec > openapi.json
	@echo "Generating TypeScript client..."
	@cd frontend && npx openapi-typescript ../openapi.json -o src/api/schema.ts
	@echo "Client generated at frontend/src/api/schema.ts"

# Clean up generated OpenAPI spec file
clean-spec:
	@rm -f openapi.json
