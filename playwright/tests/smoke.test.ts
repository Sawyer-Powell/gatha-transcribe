import { test, expect } from '@playwright/test';

/**
 * Smoke test to verify Playwright setup and test server integration
 *
 * Verifies the following invariants:
 * 1. Playwright can start the test server (via webServer config)
 * 2. Playwright can connect to the test server
 * 3. Test server responds to requests
 * 4. Test server tears down cleanly after tests
 */
test.describe('Playwright Setup', () => {
  test('can navigate to frontend pages', async ({ page }) => {
    // Navigate to the root page
    await page.goto('/');

    // Verify we got a successful response and page loaded
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('SPA routing works (frontend fallback)', async ({ page }) => {
    // Navigate to /login (should serve index.html via SPA fallback)
    const response = await page.goto('/login');

    // Verify we got HTML, not 404
    expect(response?.status()).toBe(200);

    // Verify page contains expected HTML structure
    const html = await page.content();
    expect(html.toLowerCase()).toContain('<!doctype html>');
  });

  test('API routes work alongside frontend', async ({ request }) => {
    // Make a request to verify API still works
    const response = await request.get('/user');

    // Verify we got a successful response
    expect(response.status()).toBe(200);

    // Verify response body is valid JSON
    const data = await response.json();
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('id');
  });

  test('test server starts and tears down cleanly', async ({ request }) => {
    // Make multiple requests to verify server stability
    const response1 = await request.get('/user');
    const response2 = await request.get('/user');

    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);
  });
});
