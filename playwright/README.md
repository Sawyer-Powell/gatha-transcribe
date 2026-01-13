# Playwright E2E Tests

End-to-end tests for Gatha Transcribe using Playwright and the Rust test server.

## Setup

Install dependencies:

```bash
cd playwright
npm install
npm run playwright:install
```

## Running Tests

```bash
npm test              # Run all tests
npm run test:ui       # Run with UI mode
npm run test:debug    # Run in debug mode
npm run test:headed   # Run in headed mode (see browser)
```

## Test Server Integration

The Playwright config automatically starts and stops the Rust test server (`cargo run --bin test-server`) before/after running tests. The test server provides:

- In-memory SQLite database
- Pre-seeded test user: `test@example.com` / `password123`
- Pre-seeded test videos from `fixtures/videos/`

## Writing Tests

Tests are located in `tests/` directory. Example:

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ request }) => {
  const response = await request.get('/user');
  expect(response.status()).toBe(200);
});
```

## Configuration

- **Browser**: Chromium only
- **Base URL**: `http://127.0.0.1:3000`
- **Test server**: Auto-started via `webServer` config
- **Retries**: 2 retries on CI, 0 locally
- **Workers**: Serial on CI, parallel locally

See `playwright.config.ts` for full configuration.
