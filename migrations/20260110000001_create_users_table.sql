-- Create users table
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Index for fast email lookups during login
CREATE UNIQUE INDEX idx_users_email ON users(email);
