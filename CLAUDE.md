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

## Version Control with jj

We use **jj (Jujutsu)**, not git. Basic workflow:

```bash
jj status                   # Check working copy changes
jj describe -m "message"    # Set commit message
jj bookmark set main -r @   # Move main bookmark to current commit
jj git push                 # Push to remote
jj log -r ::@ --limit 5     # View recent commits
jj abandon                  # Discard unwanted changes
```

**Commit format:**
```
<imperative title>

<optional description>

Resolves: <bead-id>
```

Example: `jj describe -m "Add JWT authentication\n\nResolves: gatha-transcribe-abc"`

## CRITICAL Coding Workflow using Beads

**One bead = one small testable component = one commit**

8-Step Process:
1. **Read** - Review bead requirements and existing code
2. **Assess** - Understand scope and identify files to change
3. **Design & Confirm** - Plan approach, ask clarifying questions
4. **Implement** - Write code (prefer editing over creating files)
5. **Execute Tests** - Run automated tests to verify invariants
6. **Ask Follow-up** - Check if additional work discovered
7. **User Review** - Get user acceptance of implementation
8. **Commit & Push** - Close bead, sync, commit with jj, push

**Key Commands:**
```bash
bd ready                    # Find available work
bd show <id>                # View bead details
bd update <id> --status=in_progress  # Claim work
bd close <id1> <id2> ...    # Close completed beads
bd sync --from-main         # Sync beads before push
```

**Session Close:**
1. `bd close <ids>` - Close all completed beads
2. `bd sync --from-main` - Pull latest beads
3. `jj describe -m "message\n\nResolves: <id>"`
4. `jj bookmark set main -r @`
5. `jj git push`

## Code Style Guide

**General:**
- NO emojis in code (comments, logs, errors, UI text)
- ALWAYS prefer editing existing files over creating new ones
- Read files before editing them
- Professional, informative tone

**Testing:**
- Test invariants, not implementation details
- Every bead requires automated tests
- Verify system behavior, not internal functions

**JavaScript/TypeScript:**
- Simple functional style, no classes
- No module-level state
- Pure functions where possible

**Rust:**
- Standard patterns (impl blocks are fine)
- Use thiserror for error types
- Parameterized SQL queries (no string interpolation)

**Security:**
- Validate at system boundaries only (user input, external APIs)
- Trust internal code and framework guarantees
- No over-defensive programming

## Important

- Work is NOT complete until `jj git push` succeeds
- See `.clauderules` for critical reminders
- See folder-specific CLAUDE.md for detailed context
