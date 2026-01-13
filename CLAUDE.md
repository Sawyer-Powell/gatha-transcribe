# Gatha Transcribe - Developer Guide

> **For Claude Code**: Critical workflow and project reference. Read the workflow section first.

## 🚨 MANDATORY BEAD WORKFLOW - Follow Exactly

### Core Principles
1. **One bead = one small testable component = one commit**
2. **Every bead has automated tests that verify system invariants**
3. **All work is verified by executing tests before user review**
4. **Simple functional style: no classes, no module-level state (JS/TS)**

### Working on Epics

**When starting work on an epic**, the first step is ALWAYS to clarify the exact work with the user through questions.

**Process:**
1. **Lead with Questions** - Ask clarifying questions about:
   - What are the specific acceptance criteria?
   - What are the key invariants that must hold?
   - Are there any constraints or preferences on implementation approach?
   - What's the priority order of sub-components?
   - Are there any examples or reference implementations?
   - **USE the AskUserQuestion tool** (Claude Code question feature) to ask questions sequentially, not all at once

2. **Break Down into Beads** - Based on the answers:
   - Propose a list of concrete, small beads
   - Each bead should be independently testable
   - Order beads by dependencies and value

3. **Get Confirmation** - Wait for user approval on:
   - The breakdown approach
   - The bead boundaries
   - The implementation order

4. **Create Bead Issues** - After confirmation:
   - Create individual bead issues in the tracker
   - Link dependencies between beads
   - Update the epic with the breakdown

5. **Execute Beads** - Follow the 8-step workflow for each bead

**Key Rules**:
- Never assume you understand the full scope of an epic. Always start with questions.
- Use AskUserQuestion tool to ask questions one at a time, not in bulk.

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

### Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `jj git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   jj git fetch            # Fetch latest from remote
   bd sync                 # Sync beads
   jj bookmark set main -r @  # Move bookmark to current commit
   jj git push             # Push changes
   jj log -r @             # Verify current change is pushed
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

---

## Quick Reference

### Beads Commands
```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status=in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with jj
```

### Development Commands
```bash
# Backend
cargo run                    # Start server
cargo nextest run            # Run tests
make db-setup                # Setup database

# Frontend
cd frontend
npm run dev                  # Start dev server (localhost:5173)
npm test                     # Run tests

# Version Control
jj log                       # View commit history
jj describe -m "message"     # Set commit message
jj bookmark set main -r @    # Move bookmark
jj git push                  # Push to remote
```

### Testing Requirements

**What to Test:**
- System invariants, not individual functions
- Each bead must have at least one automated test
- Tests must be executable and deterministic

**How to Verify:**
- Run test suite: `cargo nextest run` (backend) or `npm test` (frontend)
- Show actual test execution output
- For E2E: Run Playwright tests when available

**Test Output Must Show:**
- All tests passing
- Specific invariants verified
- No flaky or skipped tests

### Code Style Requirements

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
- Methods on structs are fine
- Avoid global mutable state
- Use standard Rust patterns (impl blocks, traits, etc.)

**Professional Tone:**
- **NO emojis in code** - Avoid emojis at all costs in source code, comments, error messages, or logs
- Maintain a professional, informative tone throughout
- Use clear, descriptive text instead of decorative elements
- Example:
  ```rust
  // ❌ Bad: Uses emojis
  println!("🚀 Test server ready!");
  println!("  ✓ Test user created: {}", user.email);

  // ✅ Good: Professional, informative
  println!("Test server ready");
  println!("Test user created: {}", user.email);
  ```

---

## Project Overview

**Gatha Transcribe** is a video transcription application with:
- **Frontend**: Preact + TypeScript + TailwindCSS
- **Backend**: Rust + Axum + SQLite
- **Features**:
  - Video upload (streaming, handles large files)
  - User authentication (HTTP-only cookies, JWT)
  - Real-time transcription display
  - Protected routes

**Tech Stack**:
- Frontend: Preact, Zustand, preact-iso, openapi-fetch
- Backend: Axum, SQLx, Tower, bcrypt, jsonwebtoken
- Database: SQLite
- Testing: Vitest (frontend), cargo-nextest (backend)

---

## Architecture

```
gatha-transcribe/
├── frontend/           # Preact frontend
│   ├── src/
│   │   ├── api/       # OpenAPI client
│   │   ├── components/# Reusable UI components
│   │   ├── features/  # Feature modules (transcriber)
│   │   ├── pages/     # Route pages (LoginPage)
│   │   ├── stores/    # Zustand stores (auth)
│   │   └── app.tsx    # Main app with routing
├── src/               # Rust backend
│   ├── lib.rs        # Router, middleware setup
│   ├── auth.rs       # Authentication (JWT, bcrypt)
│   ├── upload.rs     # Video upload handlers
│   ├── db.rs         # Database models & queries
│   ├── error.rs      # Application-wide error types
│   └── websocket.rs  # WebSocket handlers
├── migrations/        # SQLx migrations
└── tests/            # E2E tests
    ├── common/mod.rs # Shared test helpers
    ├── auth_e2e.rs
    ├── upload_e2e.rs
    └── session_persistence_e2e.rs
```

**Data Flow**:
1. User uploads video → Backend streams to filestore → Saves metadata in DB
2. User logs in → Backend creates JWT → Stores in HTTP-only cookie
3. WebSocket connects → Backend sends transcription updates → Frontend displays

**Important Files**:
- `frontend/src/app.tsx` - Main app, routing setup
- `frontend/src/stores/authStore.ts` - Auth state management
- `src/lib.rs` - Backend router & middleware
- `src/auth.rs` - Authentication logic
- `src/error.rs` - Application error types (AppError with thiserror)
- `tests/common/mod.rs` - Shared test helpers

---

## Backend Key Modules

### `auth.rs` - Authentication
- **Hash password**: bcrypt with DEFAULT_COST
- **Verify password**: bcrypt comparison
- **Create token**: JWT with 30-day expiration
- **Security features**:
  - Bcrypt password hashing
  - HTTP-only cookies (XSS protection)
  - Secure flag in production (HTTPS only)
  - SameSite=Lax (CSRF protection)
  - Randomized login delay (timing attack prevention)

### `error.rs` - Error Management
- **Type**: `AppError` enum with `thiserror` for automatic trait implementations
- **Auto-conversion**: `#[from]` attribute generates `From` trait implementations
  - `sqlx::Error` → `AppError::Database`
  - `validator::ValidationErrors` → `AppError::Validation`
  - `bcrypt::BcryptError` → `AppError::Bcrypt`
- **IntoResponse**: Automatically converts to Axum HTTP responses
- **User messages**: Hides internal error details in production

### `upload.rs` - Video Upload
- **Streaming**: Uses Axum's `Multipart` for streaming large files
- **Memory usage**: Constant (~1-8 MB) regardless of file size due to streaming
- **Max size**: 100 MB (configurable via `DefaultBodyLimit`)

### `db.rs` - Database Layer
- **Pattern**: Uses `sqlx::query!` macros for compile-time query verification
- **Methods**: `insert_video`, `get_video`, `insert_user`, `upsert_session`, etc.

---

## Frontend Key Concepts

### Routing (preact-iso)
- **Routes**:
  - `/` - Protected transcriber page (lazy loaded)
  - `/login` - Login/register page (lazy loaded)
- **Pattern**: Named route components (avoid inline functions)

### Authentication (Zustand + HTTP-only cookies)
- **Store**: `authStore.ts`
- **Actions**: `login`, `register`, `logout`, `checkAuth`
- **Flow**: App calls `checkAuth()` on mount → hits `/api/auth/me` → redirects if needed

### Lazy Loading & Code Splitting
- **Pattern**: Use `lazy()` from `preact/compat` for page-level components
- **Bundle sizes**:
  - Initial: ~34 kB (gzipped: 13 kB)
  - LoginPage: ~2 kB (gzipped: 0.75 kB)
  - Transcriber: ~61 kB (gzipped: 21 kB)

---

## Database

### Schema

**Videos table**:
```sql
CREATE TABLE videos (
    id TEXT PRIMARY KEY NOT NULL,
    file_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    user_id TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
);
```

**Users table**:
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

**Transcription Sessions table**:
```sql
CREATE TABLE transcription_sessions (
    user_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, video_id)
);
```

### Setup & Migrations

```bash
make db-setup                # Setup database (creates gatha.db)
make db-reset                # Reset database
sqlx migrate add <name>      # Create new migration
cargo sqlx prepare           # Update offline data
```

---

## Testing

### Backend Tests

**Tool**: cargo-nextest (faster, better than cargo test)

```bash
cargo nextest run            # Run all tests
cargo nextest run --profile profiling  # Serial execution, detailed timing
cargo nextest run --run-ignored all    # Includes 1GB upload test
```

**Test Structure**:
- `tests/common/mod.rs` - Shared test helpers
  - `create_test_state()` - Creates temporary database and filestore
  - `start_test_server()` - Spawns test server on random port
  - `create_authenticated_client()` - Returns client with cookies
- `tests/auth_e2e.rs` - Auth E2E tests
- `tests/upload_e2e.rs` - Video upload E2E tests
- `tests/session_persistence_e2e.rs` - Session persistence tests

**Performance benchmarks** (M-series Mac):
- 10MB upload: ~94ms
- 1GB upload: ~6.51s (~161 MB/s throughput)

### Frontend Tests

**Tool**: Vitest + @testing-library/preact

```bash
npm test                     # Run all tests
npm run test:watch           # Watch mode
npm run test:ui              # Visual test runner
```

**Test Philosophy**: Focused, high-value tests. No shallow component tests.

---

## Common Tasks

### Add a New Backend Endpoint

1. **Create handler** in appropriate module (e.g., `src/my_feature.rs`)
2. **Register in `lib.rs`**: `.routes(routes!(my_feature::my_handler))`
3. **Update OpenAPI spec**: `cargo run` generates `openapi.json`

### Add a Database Migration

1. **Create migration**: `sqlx migrate add create_my_table`
2. **Edit migration** in `migrations/<timestamp>_create_my_table.sql`
3. **Run migration**: `make db-setup` or restart server (auto-migrates)
4. **Update offline data**: `cargo sqlx prepare`

### Add a New Frontend Route

1. **Create page component** in `src/pages/NewPage.tsx`
2. **Lazy load in `app.tsx`**: `const NewPage = lazy(() => import('./pages/NewPage')...)`
3. **Add to Router**: `<Route path="/new" component={NewPageRoute} />`
4. **Make protected (optional)**: Wrap with `<ProtectedRoute>`

---

## API Reference

### Authentication Endpoints

**`POST /api/auth/register`** - Register new user
- Body: `{ "name": "...", "email": "...", "password": "..." }`
- Response: `{ "user": {...}, "message": "..." }`

**`POST /api/auth/login`** - Login
- Body: `{ "email": "...", "password": "..." }`
- Response: `{ "user": {...}, "message": "..." }`
- Note: Includes randomized 50-200ms delay for timing attack prevention

**`POST /api/auth/logout`** - Logout
- Response: `{ "message": "Logout successful" }`

**`GET /api/auth/me`** - Get current user
- Response: `{ "id": "...", "name": "...", "email": "..." }`
- Errors: 401 if not authenticated

### Upload Endpoints

**`POST /api/videos/upload`** - Upload video
- Content-Type: `multipart/form-data`
- Form field: `video` (file)
- Supported formats: MP4, MOV, AVI, WebM, MKV
- Response: `{ "id": "...", "message": "Video uploaded successfully" }`

---

## Troubleshooting

### Frontend Issues

**"Cyclic structure" error** - Use named components, not inline functions in Route
**401 errors on login page** - Expected behavior, `checkAuth()` runs on all pages
**Routes not rendering** - Check browser console, verify import paths

### Backend Issues

**Database locked errors** - Stop all instances, delete `.db-shm` and `.db-wal` files
**Upload fails with large files** - Increase `DefaultBodyLimit` in `lib.rs`
**Compile errors with sqlx queries** - Run `make db-reset && cargo sqlx prepare`

---

## Environment Variables

### Backend (.env in project root)
```env
DATABASE_URL=sqlite:gatha.db
FILESTORE_PATH=test_filestore
JWT_SECRET=your-secret-key-change-in-production
ENVIRONMENT=development  # Set to 'production' for secure cookies
PORT=3000
RUST_LOG=info
```

### Frontend (frontend/.env)
```env
VITE_API_URL=http://localhost:3000
```

---

## Security Checklist

### Production Deployment
- [ ] Set `JWT_SECRET` to strong random value
- [ ] Set `ENVIRONMENT=production`
- [ ] Enable HTTPS (for Secure cookie flag)
- [ ] Configure CORS allowed origins (not `Any`)
- [ ] Add rate limiting on auth endpoints
- [ ] Review file upload size limits

### Development
- ✅ Passwords hashed with bcrypt
- ✅ HTTP-only cookies (XSS protection)
- ✅ JWT with expiration
- ✅ Parameterized queries (SQL injection protection)
- ✅ CORS configured
- ✅ Request size limits

---

## Port Numbers
- Frontend dev server: 5173
- Backend server: 3000

---

**Last Updated**: 2026-01-12

**Questions?** Check the inline code comments or run tests to see examples.
