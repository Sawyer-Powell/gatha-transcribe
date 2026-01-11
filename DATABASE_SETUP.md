# Database Setup

This project uses SQLite with sqlx for database management.

## Initial Setup

1. **Install sqlx-cli** (optional, for managing migrations manually):
   ```bash
   cargo install sqlx-cli --no-default-features --features sqlite
   ```

2. **Set up the database**:
   ```bash
   make db-setup
   ```

3. **The migrations will run automatically** when you start the server.

## Database Location

- Database file: `gatha.db` (in the project root)
- Migrations: `migrations/` directory

## Migrations

Migrations are embedded in the binary and run automatically on server startup.

To create a new migration manually:
```bash
sqlx migrate add <migration_name>
```

This will create a new file in `migrations/` with a timestamp prefix.

## Reset Database

To delete and recreate the database:
```bash
make db-reset
```

## SQLx Offline Mode

For compile-time query verification without a database connection, we use sqlx offline mode:

```bash
# Prepare offline data (after migrations are applied)
cargo sqlx prepare
```

This creates `.sqlx/` directory with query metadata for compile-time verification.

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL`: Path to SQLite database
- `FILESTORE_PATH`: Directory for storing uploaded files
