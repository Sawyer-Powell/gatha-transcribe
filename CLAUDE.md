# Gatha Transcribe - Quick Reference

Video transcription app with Preact frontend, Rust/Axum backend, SQLite database.

## Documentation Structure

- **`playwright/CLAUDE.md`** - E2E testing setup and patterns
- **`frontend/CLAUDE.md`** - Frontend architecture and development
- **`src/CLAUDE.md`** - Backend architecture and API design
- **`.clauderules`** - Critical rules (jj, beads, code style)

## Quick Start

**Backend:**
```bash
cargo run --bin test-server  # Test server with seeded data
cargo nextest run            # Run tests
make db-setup                # Setup database
```

**Frontend:**
```bash
cd frontend
npm run dev                  # Dev server (localhost:5173)
npm test                     # Run tests
npm run build                # Build for production
```

**E2E Tests:**
```bash
cd playwright
npm test                     # Run Playwright tests
```

## Architecture Overview

```
frontend/          → Preact SPA (port 5173)
src/              → Rust/Axum API (port 3000)
├── auth.rs       → JWT authentication, bcrypt
├── upload.rs     → Streaming video uploads
├── db.rs         → SQLite with SQLx
└── websocket.rs  → Real-time transcription
playwright/       → E2E tests with test server
```

## Key Tech

- **Frontend:** Preact, Zustand, preact-iso, openapi-fetch
- **Backend:** Axum, SQLx, Tower, JWT, bcrypt
- **Database:** SQLite with migrations
- **Testing:** Vitest (frontend), cargo-nextest (backend), Playwright (E2E)

## Development Workflow

1. Check `bd ready` for available beads
2. Claim work: `bd update <id> --status=in_progress`
3. Implement following 8-step bead workflow
4. Run tests and verify invariants
5. Get user acceptance
6. Close bead: `bd close <id>`
7. Commit: `jj describe -m "..."` → `jj bookmark set main -r @` → `jj git push`

## Important

- Work is NOT complete until `jj git push` succeeds
- Every bead requires automated tests
- Test invariants, not implementation details
- See `.clauderules` for mandatory rules
- See folder-specific CLAUDE.md for detailed context
