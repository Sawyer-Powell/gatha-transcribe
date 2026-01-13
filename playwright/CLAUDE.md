# Playwright E2E Tests

Chromium-only E2E tests using Rust test server with seeded data.

## Running Tests

```bash
npm test              # Run all tests
npm run test:ui       # UI mode
npm run test:debug    # Debug mode
npm run test:headed   # See browser
```

## Test Server Integration

`playwright.config.ts` auto-starts test server:
- Command: `cd .. && cargo run --bin test-server`
- URL: `http://127.0.0.1:3000`
- Seeded user: `test@example.com` / `password123`
- Seeded videos from `fixtures/videos/`

## Writing Tests: Focus on System Invariants

**CRITICAL PRINCIPLE:** Playwright tests verify important **system invariants**, not implementation details.

### Workflow for New Tests

**1. Identify System Invariants (Q&A with User)**
Before writing tests, use **AskUserQuestion** tool to confirm:
- What system-level behavior must always be true?
- What are the critical user flows that must work?
- What are the acceptance criteria for this feature?

**2. Write Focused Tests**
Each test verifies ONE important invariant. Examples of good invariants:
- "Logged-in users can upload videos and see them in their list"
- "Session persists across page refreshes"
- "Unauthorized users cannot access protected pages"

**3. Avoid Testing Implementation**
Don't test:
- Internal function calls
- Component rendering details
- API request/response formats (unless that IS the invariant)

**Location:** `tests/*.test.ts`

**Pattern:**
```typescript
import { test, expect } from '@playwright/test';

test('user can log in and session persists across refresh', async ({ page }) => {
  await page.goto('/login');
  // Test the invariant: authentication works end-to-end
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Verify logged-in state
  await expect(page.locator('text=Dashboard')).toBeVisible();

  // Verify session persists (the invariant)
  await page.reload();
  await expect(page.locator('text=Dashboard')).toBeVisible();
});
```

## Test Structure

```
playwright/
├── tests/           # Test files
├── fixtures/        # Test helpers
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

## Key Patterns

- **Test system invariants, not implementation details**
- **Always confirm invariants with user via AskUserQuestion before writing tests**
- Use `page` for browser interactions
- Use `request` for API calls when testing API-level invariants
- Keep tests focused on critical user flows and acceptance criteria
- One test = one important invariant

## Configuration

- Browser: Chromium only
- Base URL: `http://127.0.0.1:3000`
- Retries: 2 on CI, 0 locally
- Test server timeout: 30 seconds

## Debugging

```bash
npm run test:debug   # Opens inspector
npm run test:headed  # Shows browser
```

Check test server logs if tests fail to start.

## Workflow for Adding New Tests

**1. Confirm Invariants (MANDATORY)**
Use **AskUserQuestion** tool to establish:
- What system behavior are we testing?
- What must always be true?
- What are the acceptance criteria?

**2. Map Out Selectors**
Spin up the test server: `cargo run --bin test-server`

Then use playwright-mcp (if available) against `localhost:3000` to:
- Identify selectors needed for the test
- Understand the user flow
- Map out the test structure

**3. Write Focused Test**
Write ONE test per invariant. Keep it simple and focused on the system-level behavior.

**4. Verify Test**
Run the test to ensure it verifies the invariant correctly.
