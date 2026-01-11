.PHONY: generate-types generate-client clean-spec db-setup db-reset

# Generate TypeScript types from Rust (both ts-rs types and OpenAPI client)
generate-types:
	@cargo run --bin generate-types
	@echo "\nGenerating TypeScript OpenAPI client..."
	@cd frontend && npx openapi-typescript ../openapi.json -o src/api/schema.ts
	@echo "✓ OpenAPI client generated at frontend/src/api/schema.ts"

# Set up database (create if doesn't exist, run migrations)
db-setup:
	@echo "Setting up database..."
	@touch gatha.db
	@echo "✓ Database file created"
	@echo "Migrations will run automatically when the server starts"

# Reset database (delete and recreate)
db-reset:
	@echo "Resetting database..."
	@rm -f gatha.db gatha.db-shm gatha.db-wal
	@touch gatha.db
	@echo "✓ Database reset complete"
	@echo "Migrations will run automatically when the server starts"
