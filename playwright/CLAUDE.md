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

## Writing Tests

**Location:** `tests/*.test.ts`

**Pattern:**
```typescript
import { test, expect } from '@playwright/test';

test('descriptive name', async ({ page, request }) => {
  await page.goto('/login');
  // ... assertions
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

- Use `page` for browser interactions
- Use `request` for API calls
- Test invariants: server starts, frontend loads, APIs work, server tears down
- Keep tests focused on user flows, not implementation

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
