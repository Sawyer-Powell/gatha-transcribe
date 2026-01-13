# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Core Principles

1. **One bead = one small testable component = one commit**
2. **Every bead has automated tests that verify system invariants**
3. **All work is verified by executing tests before user review**
4. **Simple functional style: no classes, no module-level state (JS/TS)**

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with jj
```

## Bead Workflow (Follow This Exactly)

**For each bead:**

1. **Read & Understand**
   - Read existing code first
   - Understand how it fits the system model
   - Identify the invariants that must hold

2. **Assess Scope & Break Down**
   - If the bead requires multiple systems/components:
     - Propose breaking it into smaller beads
     - List the smaller units of work
     - Get user confirmation on the breakdown
   - If the bead is already small and focused, proceed

3. **Design & Confirm**
   - Explain your approach
   - List the invariants you'll enforce
   - Wait for user confirmation if non-trivial

4. **Implement Small**
   - Write one small, testable component
   - Write automated test(s) that verify invariants
   - Keep changes focused (ideally < 3 files)

5. **Execute Tests**
   - Run the specific tests for this bead
   - Show test output proving invariants hold
   - ALL tests must pass before proceeding

6. **Ask Follow-Up Questions**
   - After first implementation, ask questions about:
     - Do the invariants match expectations?
     - Are acceptance criteria met?
     - Are implementation details correct?
   - Your first attempt is not your last

7. **User Review**
   - User reviews test output and implementation
   - User accepts or rejects
   - If rejected, iterate from step 4

8. **Commit & Push** (Only after acceptance)
   - One bead = one commit
   - Use `jj describe -m` to set commit message (follow format below)
   - Move bookmark: `jj bookmark set main -r @` (required before push)
   - Push: `jj git push`
   - Update bead status with `bd close <id>` or `bd update <id>`

## Commit Message Format

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

**Description:**
- Optional, add if context is needed
- Explain why, not what (the diff shows what)

**Bead Reference:**
- Always include "Resolves: <bead-id>" in commit body
- Use the full bead ID (e.g., "gatha-transcribe-a6z")

**Example:**
```bash
jj describe -m "Add session persistence tests

Tests verify that session data serializes correctly to database
and can be reliably retrieved after server restart.

Resolves: gatha-transcribe-a6z"

jj bookmark set main -r @
jj git push
```

## Code Style Requirements

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

## Testing Requirements

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

## Invariants & Acceptance Criteria

**When working on a bead:**
- Identify the invariants that define correctness
- Example: "Session data persists after server restart"
- Example: "Video upload handles files > 100MB without memory spike"
- Write tests that verify these invariants
- Include invariants in bead acceptance criteria

## Change Size Guidelines

**Keep beads small:**
- Each bead is independently testable
- If you're changing > 3 files significantly, consider splitting
- Better to have 5 small beads than 1 large bead
- Each bead leaves the system in a working state

## Landing the Plane (Session Completion)

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

