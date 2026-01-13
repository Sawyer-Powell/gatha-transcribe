import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Gatha Transcribe E2E tests
 *
 * This config integrates with the Rust test server binary which provides:
 * - In-memory SQLite database
 * - Pre-seeded test user (test@example.com / password123)
 * - Pre-seeded test videos from fixtures/
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all projects
  use: {
    // Base URL for the test server
    baseURL: 'http://127.0.0.1:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for Chromium only
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run test server before starting the tests
  webServer: {
    command: 'cd .. && cargo run --bin test-server',
    url: 'http://127.0.0.1:3000/user',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30 * 1000, // 30 seconds to start
  },
});
