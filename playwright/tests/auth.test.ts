import { test, expect } from '../fixtures/test';

/**
 * Authentication Flow E2E Tests
 *
 * Tests the complete authentication flow including:
 * - User registration
 * - Login with correct/incorrect credentials
 * - Logout functionality
 * - Protected route enforcement
 * - Session persistence
 *
 * Invariants:
 * - Auth cookies are set/cleared correctly
 * - Protected routes redirect unauthenticated users
 * - Login/register page redirects authenticated users
 * - Session state managed correctly across page refreshes
 */
test.describe('Authentication Flow', () => {
  test('register new user creates account and sets auth cookie', async ({ page, context }) => {
    // Generate unique email for this test run
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    const testPassword = 'password123';
    const testName = `Test User ${timestamp}`;

    // Navigate to login page
    await page.goto('/login');

    // Switch to Register tab
    await page.getByRole('button', { name: 'Register', exact: true }).first().click();

    // Wait for form to update
    await expect(page.getByLabel('Name')).toBeVisible();

    // Fill registration form
    await page.getByLabel('Name').fill(testName);
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);

    // Submit form - use the submit button in the form
    await page.locator('form button[type="submit"]').click();

    // Wait for redirect to transcriber page
    await page.waitForURL('/', { timeout: 10000 });

    // Verify auth cookie was set
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeDefined();
    expect(authCookie?.httpOnly).toBe(true);
    expect(authCookie?.sameSite).toBe('Lax');
  });

  test('login with correct credentials succeeds and sets auth cookie', async ({ page, context }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill login form with seeded test user
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Submit form
    await page.locator('form button[type="submit"]').click();

    // Wait for redirect to transcriber page
    await page.waitForURL('/', { timeout: 10000 });

    // Verify auth cookie was set
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeDefined();
    expect(authCookie?.httpOnly).toBe(true);
  });

  test('login with incorrect credentials shows error', async ({ page, context }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill login form with wrong credentials
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    // Submit form
    await page.locator('form button[type="submit"]').click();

    // Wait for error message to appear (the backend responds with error text)
    await page.waitForTimeout(1000); // Give time for API response

    // Verify error message is displayed
    await expect(page.locator('.text-destructive')).toBeVisible();

    // Verify we stayed on login page
    await expect(page).toHaveURL('/login');

    // Verify no auth cookie was set
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeUndefined();
  });

  test('logout clears auth cookie and redirects to login', async ({ page, context }) => {
    // First, login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });

    // Verify auth cookie exists
    let cookies = await context.cookies();
    let authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeDefined();

    // Click logout button
    await page.getByRole('button', { name: /logout/i }).click();

    // Confirm logout in modal
    await page.getByRole('button', { name: 'Logout', exact: true }).click();

    // Wait for redirect to login page
    await page.waitForURL('/login', { timeout: 10000 });

    // Verify auth cookie was cleared (max-age should be 0 or cookie removed)
    cookies = await context.cookies();
    authCookie = cookies.find(c => c.name === 'auth_token' && c.value !== '');
    expect(authCookie).toBeUndefined();
  });

  test('re-login after logout succeeds', async ({ page, context }) => {
    // First login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });

    // Logout
    await page.getByRole('button', { name: /logout/i }).click();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.waitForURL('/login', { timeout: 10000 });

    // Re-login with same credentials
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();

    // Verify successful login
    await page.waitForURL('/', { timeout: 10000 });

    // Verify auth cookie was set again
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeDefined();
  });

  test('protected route redirects unauthenticated user to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/');

    // Wait for redirect to login page
    await page.waitForURL('/login', { timeout: 10000 });
  });

  test('authenticated user redirected from login page to transcriber', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });

    // Try to navigate to login page while authenticated
    await page.goto('/login');

    // Verify redirect back to transcriber (may take a moment for checkAuth)
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('session persists across page refresh', async ({ page, context }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });

    // Verify auth cookie exists
    let cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeDefined();

    // Reload the page
    await page.reload();

    // Wait a moment for auth check to complete
    await page.waitForTimeout(1000);

    // Verify still on transcriber page (not redirected to login)
    await expect(page).toHaveURL('/');

    // Verify auth cookie still present
    cookies = await context.cookies();
    const authCookieAfterReload = cookies.find(c => c.name === 'auth_token');
    expect(authCookieAfterReload).toBeDefined();
    expect(authCookieAfterReload?.value).toBe(authCookie?.value);
  });
});
