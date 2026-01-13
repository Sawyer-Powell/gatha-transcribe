# Critical Rules

> Quick reference for essential workflow rules. See CLAUDE.md for detailed documentation.

## Version Control: jj (Jujutsu)

**We use jj (Jujutsu), not git commands directly.**

- **Commit workflow**: `jj describe -m` → `jj bookmark set main -r @` → `jj git push`
- **View history**: `jj log -r ::@ --limit 5`
- **Check status**: `jj status`
- **Discard changes**: `jj abandon`

See CLAUDE.md → "Version Control with jj" for complete workflow.

## Issue Tracking: beads

**Use beads for multi-session work, dependencies, and discovered tasks.**

- **Find work**: `bd ready` (shows unblocked tasks)
- **Start work**: `bd update <id> --status=in_progress`
- **Complete work**: `bd close <id1> <id2> ...` (close multiple at once)
- **Sync beads**: `bd sync --from-main` (run before pushing)
- **Epic beads**: Use AskUserQuestion tool to establish requirements, then break down into smaller beads with dependencies before implementing

See CLAUDE.md → "Bead Workflow" for 8-step process.

## Code Style Standards

**Non-negotiable style rules:**

- **NO emojis** in code (comments, logs, errors, UI text)
- **Test invariants, not implementation details** (test system behavior, not internal functions)
- **Always prefer editing existing files over creating new ones**
- **Read files before editing them** (required by Edit tool)
- **JavaScript/TypeScript**: Simple functional style, NO classes, NO module-level state
- **Rust**: Use thiserror for errors, parameterized SQL queries only

See CLAUDE.md → "Code Style Guide" for complete standards.

## Session Close Checklist

**MANDATORY steps before ending session - work is NOT complete until `jj git push` succeeds:**

1. **Close completed beads**: `bd close <id1> <id2> ...`
2. **Sync beads**: `bd sync --from-main`
3. **Describe commit**: `jj describe -m "Title\n\nDescription\n\nResolves: <bead-id>"`
4. **Move bookmark**: `jj bookmark set main -r @`
5. **Push to remote**: `jj git push`
6. **Verify**: `jj log -r @` (confirm push succeeded)

**NEVER say "ready to push when you are" - YOU must complete the push.**
