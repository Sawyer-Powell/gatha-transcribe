import { test, expect } from '../fixtures/test';

/**
 * Pre-seeded Video Display E2E Tests
 *
 * Tests that pre-seeded videos display correctly in the transcriber UI.
 *
 * Invariants:
 * - Seeded videos are accessible via API
 * - UI renders video list correctly
 * - Video metadata displays properly
 * - Video player loads when video is selected
 */
test.describe('Pre-seeded Video Display', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('pre-seeded video appears in sidebar', async ({ page }) => {
    // Verify video count is displayed
    await expect(page.getByText('1 video')).toBeVisible();

    // Verify the seeded video appears in the list
    await expect(page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();

    // Verify no error messages
    await expect(page.getByText(/failed to load/i)).not.toBeVisible();
  });

  test('video metadata displays correctly', async ({ page }) => {
    // Verify filename is displayed correctly
    const videoButton = page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' });
    await expect(videoButton).toBeVisible();

    // Verify the filename text is present
    await expect(page.getByText('Zoom Meeting Recording.mp4')).toBeVisible();
  });

  test('video can be selected and becomes active', async ({ page }) => {
    // Click on the video
    const videoButton = page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' });
    await videoButton.click();

    // Wait a moment for selection to process
    await page.waitForTimeout(500);

    // Verify video is now active (has accent background classes)
    await expect(videoButton).toHaveClass(/bg-accent/);

    // Verify video title appears at top of page
    await expect(page.getByRole('heading', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();
  });

  test('video player loads when video is selected', async ({ page }) => {
    // Select the video
    await page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' }).click();

    // Verify loading indicator appears
    await expect(page.getByText('Loading video...')).toBeVisible();

    // Verify video player controls container is present
    // The player has volume, speed controls, and timeline
    await expect(page.getByText('100%')).toBeVisible(); // Volume indicator
    await expect(page.getByText(/1\.00x/)).toBeVisible(); // Playback speed indicator

    // Verify timeline/progress bar exists (slider elements)
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible();
  });

  test('multiple videos would display with correct count', async ({ page }) => {
    // This test verifies the current state (1 video)
    // Future tests with multiple videos would verify plural handling

    // Verify singular "video" text
    await expect(page.getByText('1 video')).toBeVisible();

    // Verify exactly one video button exists
    const videoButtons = page.locator('button:has-text("Zoom Meeting Recording.mp4")');
    await expect(videoButtons).toHaveCount(1);
  });

  test('no videos message does not appear when videos exist', async ({ page }) => {
    // Verify "No videos yet" message is not shown
    await expect(page.getByText('No videos yet')).not.toBeVisible();

    // Verify "No videos found" message is not shown
    await expect(page.getByText('No videos found')).not.toBeVisible();

    // Verify video list is populated
    await expect(page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();
  });

  test('search functionality works with video list', async ({ page }) => {
    // Type in search box
    const searchBox = page.getByPlaceholder('Search videos...');
    await searchBox.fill('Zoom');

    // Verify video still appears
    await expect(page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();

    // Search for non-matching text
    await searchBox.fill('nonexistent');

    // Verify "No videos found" message appears
    await expect(page.getByText('No videos found')).toBeVisible();

    // Verify video is hidden
    await expect(page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' })).not.toBeVisible();
  });

  test('video remains selected after page interactions', async ({ page }) => {
    // Select video
    await page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' }).click();
    await page.waitForTimeout(500);

    // Verify video is selected (has accent background)
    const videoButton = page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' });
    await expect(videoButton).toHaveClass(/bg-accent/);

    // Interact with other parts of the page (like search)
    await page.getByPlaceholder('Search videos...').click();

    // Verify video is still selected
    await expect(videoButton).toHaveClass(/bg-accent/);

    // Verify video title is still displayed
    await expect(page.getByRole('heading', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();
  });
});
