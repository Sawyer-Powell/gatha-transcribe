# Gatha Transcribe - Quick Reference

Video transcription app with Preact frontend, Rust/Axum backend, SQLite database.

## Documentation Structure

- **`playwright/CLAUDE.md`** - E2E testing setup and patterns
- **`frontend/CLAUDE.md`** - Frontend architecture and development
- **`src/CLAUDE.md`** - Backend architecture and API design
- **`.claude/rules/critical-rules.md`** - Critical rules (jj, beads, code style)

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

### Core Principles
1. **One bead = one small testable component = one commit**
2. **Every bead has automated tests that verify system invariants**
3. **All work is verified by executing tests before user review**
4. **Simple functional style: no classes, no module-level state (JS/TS)**

### 8-Step Workflow (Required for Every Bead)

**1. Read & Understand**
- Read existing code first
- Understand how it fits the system model
- Identify the invariants that must hold

**2. Assess Scope & Break Down**
- If the bead requires multiple systems/components:
  - Propose breaking it into smaller beads
  - List the smaller units of work
  - Get user confirmation on the breakdown
- If the bead is already small and focused, proceed

**3. Design & Confirm** ⚠️
- Explain your approach
- List the invariants you'll enforce
- **WAIT for user confirmation if non-trivial**

**4. Implement Small**
- Write one small, testable component
- Write automated test(s) that verify invariants
- Keep changes focused (ideally < 3 files)

**5. Execute Tests**
- Run the specific tests for this bead
- Show test output proving invariants hold
- **ALL tests must pass before proceeding**

**6. Ask Follow-Up Questions** ⚠️
- After first implementation, ask questions about:
  - Do the invariants match expectations?
  - Are acceptance criteria met?
  - Are implementation details correct?
- Your first attempt is not your last

**7. User Review** ⚠️
- User reviews test output and implementation
- **User accepts or rejects**
- If rejected, iterate from step 4

**8. Commit & Push** ⚠️ (Only after acceptance)
- One bead = one commit
- Use `jj describe -m` to set commit message (follow format below)
- Move bookmark: `jj bookmark set main -r @` (required before push)
- Push: `jj git push`
- Update bead status with `bd close <id>` or `bd update <id>`

### Commit Message Format

**Structure:**
```
<short title>

<optional longer description>

Resolves: <bead-id>
```

**Title Guidelines:**
- Keep as short as possible while still being useful
- Use imperative mood (e.g., "Add" not "Added" or "Adds")
- No period at the end
- Examples:
  - "Add session persistence tests"
  - "Implement Playwright test infrastructure"
  - "Fix video upload memory leak"

**Example:**
```bash
jj describe -m "Add session persistence tests

Tests verify that session data serializes correctly to database
and can be reliably retrieved after server restart.

Resolves: gatha-transcribe-a6z"

jj bookmark set main -r @
jj git push
```

### Beads Commands
```bash
bd ready                          # Find available work
bd show <id>                      # View issue details
bd update <id> --status=in_progress  # Claim work
bd close <id>                     # Complete work
bd close <id1> <id2> ...          # Close multiple issues at once
bd sync --from-main               # Sync with main branch
bd list --type=epic               # List epic beads
bd dep add <issue> <depends-on>   # Add dependency (issue depends on depends-on)
```

### Handling Epic Beads

**Epic beads** are large features that need to be broken down into smaller beads.

**When you encounter an epic bead:**
1. Use the **AskUserQuestion** tool to work with the user interactively
2. Review the epic description and acceptance criteria
3. Ask clarifying questions to establish detailed requirements
4. Propose a breakdown into smaller, concrete beads
5. Get user confirmation on the breakdown
6. Create the smaller beads with proper dependencies
7. Work through the child beads one at a time following the standard workflow

**Key principles:**
- Don't start implementing an epic directly
- Break it down first, confirm the plan with the user
- Each child bead should be independently testable
- Use `bd dep add` to link child beads to the epic

### Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `jj git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   jj git fetch                  # Fetch latest from remote
   bd sync --from-main           # Sync beads
   jj bookmark set main -r @     # Move bookmark to current commit
   jj git push                   # Push changes
   jj log -r @                   # Verify current change is pushed
   ```
5. **Clean up** - Use `jj abandon` for unwanted changes if needed
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `jj git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- Note: jj automatically tracks changes, no need for explicit add/commit commands

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
- What to test: System invariants, not individual functions
- Each bead must have at least one automated test
- Tests must be executable and deterministic

**JavaScript/TypeScript:**
- Use simple functional style
- NO classes (use plain objects and functions)
- NO module-level state
- Define state where needed, pass through function parameters
- Example:
  ```typescript
  // ✅ Good: Functional, state passed as parameter
  function processVideo(videoState: VideoState, options: Options): VideoState {
    return { ...videoState, processed: true };
  }

  // ❌ Bad: Class with instance state
  class VideoProcessor {
    private state: VideoState;
    process() { this.state.processed = true; }
  }

  // ❌ Bad: Module-level state
  let currentVideo: Video;
  function setVideo(v: Video) { currentVideo = v; }
  ```

**Rust:**
- Methods on structs are fine (standard patterns)
- Use thiserror for error types
- Avoid global mutable state
- Parameterized SQL queries (no string interpolation)
- Use standard Rust patterns (impl blocks, traits, etc.)

**Security:**
- Validate at system boundaries only (user input, external APIs)
- Trust internal code and framework guarantees
- No over-defensive programming

## Important

- Work is NOT complete until `jj git push` succeeds
- See `.clauderules` for critical reminders
- See folder-specific CLAUDE.md for detailed context
