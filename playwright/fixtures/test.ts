import { test as base, expect } from '@playwright/test';

/**
 * Extended Playwright test with automatic error detection
 *
 * This test fixture automatically:
 * - Collects console errors during test execution
 * - Collects failed network requests
 * - Fails the test if any errors are found
 *
 * Usage: Import from this file instead of '@playwright/test'
 * ```typescript
 * import { test, expect } from '../fixtures/test';
 * ```
 */

type TestFixtures = {
  autoVerifyNoErrors: void;
};

export const test = base.extend<TestFixtures>({
  autoVerifyNoErrors: [
    async ({ page }, use) => {
      const consoleErrors: string[] = [];
      const networkErrors: Array<{ url: string; status: number; statusText: string }> = [];

      // Collect console errors
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Collect failed network requests (excluding expected test-specific failures)
      page.on('response', (response) => {
        const url = response.url();

        // Ignore expected 401s during login failure tests and logout tests
        if (response.status() === 401 && url.includes('/api/auth/')) {
          return;
        }

        // Ignore expected 500s on video file requests (video file may not exist in test env)
        if (url.includes('/api/videos/') && response.status() === 500) {
          return;
        }

        // Collect other failures
        if (!response.ok() && response.status() !== 304) {
          // 304 Not Modified is not an error
          networkErrors.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
          });
        }
      });

      // Run the test
      await use();

      // After test completes, verify no errors occurred
      if (consoleErrors.length > 0) {
        console.error('Console errors detected:');
        consoleErrors.forEach((error) => console.error(`  - ${error}`));
      }

      if (networkErrors.length > 0) {
        console.error('Network errors detected:');
        networkErrors.forEach((error) =>
          console.error(`  - ${error.status} ${error.statusText}: ${error.url}`)
        );
      }

      // Fail test if any errors found
      expect(consoleErrors, 'No console errors should occur during test').toHaveLength(0);
      expect(networkErrors, 'No network errors should occur during test').toHaveLength(0);
    },
    { auto: true }, // Automatically use this fixture for every test
  ],
});

export { expect };
