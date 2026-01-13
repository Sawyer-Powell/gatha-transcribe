import { test, expect } from '../fixtures/test';

/**
 * E2E Tests - System Invariants
 *
 * These tests verify critical system-level behaviors that must always work.
 * The test fixture automatically fails tests if console errors or network
 * failures occur, so we focus only on user-facing invariants.
 */

test('test server starts and APIs work', async ({ request }) => {
  const response = await request.get('/user');
  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data).toHaveProperty('name');
  expect(data).toHaveProperty('id');
});

test('unauthenticated users redirected to login', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('/login', { timeout: 10000 });
});

test('user can log in and session persists across refresh', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.locator('form button[type="submit"]').click();

  await page.waitForURL('/', { timeout: 10000 });

  // Reload to verify session persists
  await page.reload();
  await page.waitForTimeout(1000);

  // Should still be on transcriber page, not redirected to login
  await expect(page).toHaveURL('/');
});

test('invalid credentials are rejected', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('wrongpassword');
  await page.locator('form button[type="submit"]').click();

  await page.waitForTimeout(1000);

  // Error message should appear
  await expect(page.locator('.text-destructive')).toBeVisible();

  // Should stay on login page
  await expect(page).toHaveURL('/login');
});

test('authenticated user sees video list', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL('/', { timeout: 10000 });

  // Verify video appears in list
  await expect(page.getByText('1 video')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();
});

test('video loads to last playback position and survives refresh', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL('/', { timeout: 10000 });

  // Select video
  await page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' }).click();
  await page.waitForTimeout(2000);

  // Find the timeline slider (it's the second slider - nth(1))
  // The page has: volume slider, playback speed slider, and timeline slider
  const timeline = page.locator('input[type="range"]').nth(1);
  await timeline.waitFor({ state: 'visible' });

  // Click on the timeline slider to change playback position
  await timeline.click();

  // Wait for position change to be processed and saved
  await page.waitForTimeout(1000);

  // Get the position after clicking
  const timeBefore = await page.evaluate(() => {
    const video = document.querySelector('video');
    return video ? video.currentTime : 0;
  });

  // Position should have changed from 0 (it will be around 0.5 seconds based on click position)
  expect(timeBefore).toBeGreaterThan(0);

  // Reload page
  await page.reload();
  await page.waitForTimeout(2000);

  // Verify video is still selected
  await expect(page.getByRole('heading', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();

  // Verify playback position was restored
  const timeAfter = await page.evaluate(() => {
    const video = document.querySelector('video');
    return video ? video.currentTime : 0;
  });

  // Position should be restored (within 0.5 seconds of the position before refresh)
  expect(Math.abs(timeAfter - timeBefore)).toBeLessThanOrEqual(0.5);
});
