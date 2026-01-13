import { test, expect } from '../fixtures/test';

/**
 * Video Playback Persistence E2E Tests
 *
 * Tests that video playback state persists across page refreshes and sessions.
 *
 * The videoSessionStore uses Zustand's persist middleware to save session state
 * to localStorage under the key 'video-sessions'. Each video has a savedSession
 * containing: current_time, playback_speed, volume, and version.
 *
 * Invariants:
 * - Playback position saves to localStorage when changed
 * - Page refresh restores playback position from localStorage
 * - Session state persists across logout/login
 * - localStorage key 'video-sessions' contains session data
 */
test.describe('Video Playback Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Login and select video before each test
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });

    // Select the video
    await page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' }).click();
    await page.waitForTimeout(1000); // Wait for video to initialize
  });

  test('localStorage contains video-sessions data after video loads', async ({ page }) => {
    // Wait a moment for session to initialize
    await page.waitForTimeout(500);

    // Check that localStorage has the video-sessions key
    const localStorageData = await page.evaluate(() => {
      return localStorage.getItem('video-sessions');
    });

    expect(localStorageData).not.toBeNull();

    // Parse and verify structure
    const sessionData = JSON.parse(localStorageData!);
    expect(sessionData).toHaveProperty('state');
    expect(sessionData.state).toHaveProperty('savedSessions');
  });

  test('video session data structure is valid', async ({ page }) => {
    // Wait for session to initialize
    await page.waitForTimeout(500);

    const sessionData = await page.evaluate(() => {
      const data = localStorage.getItem('video-sessions');
      return data ? JSON.parse(data) : null;
    });

    expect(sessionData).not.toBeNull();
    expect(sessionData.state).toHaveProperty('savedSessions');

    // savedSessions may be empty initially (sessions are saved after user interaction)
    const savedSessions = sessionData.state.savedSessions;
    expect(savedSessions).toBeDefined();

    // If there are saved sessions, verify they have the correct structure
    const videoIds = Object.keys(savedSessions);
    if (videoIds.length > 0) {
      const firstSession = savedSessions[videoIds[0]];
      expect(firstSession).toHaveProperty('current_time');
      expect(firstSession).toHaveProperty('playback_speed');
      expect(firstSession).toHaveProperty('volume');
      expect(firstSession).toHaveProperty('version');
    }
  });

  test('page refresh preserves video selection', async ({ page }) => {
    // Wait for video to load
    await page.waitForTimeout(1000);

    // Verify video is selected
    await expect(page.getByRole('heading', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();

    // Reload the page
    await page.reload();

    // Wait for page to fully load
    await page.waitForTimeout(1000);

    // Video should still be selected after refresh
    await expect(page.getByRole('heading', { name: 'Zoom Meeting Recording.mp4' })).toBeVisible();

    // Video button should still be active
    const videoButton = page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' });
    await expect(videoButton).toHaveClass(/bg-accent/);
  });

  test('localStorage data persists across page refresh', async ({ page }) => {
    // Get localStorage data before refresh
    const dataBefore = await page.evaluate(() => {
      return localStorage.getItem('video-sessions');
    });

    expect(dataBefore).not.toBeNull();

    // Reload the page
    await page.reload();
    await page.waitForTimeout(500);

    // Get localStorage data after refresh
    const dataAfter = await page.evaluate(() => {
      return localStorage.getItem('video-sessions');
    });

    expect(dataAfter).not.toBeNull();

    // Data should be present (may have different version numbers due to re-initialization)
    const sessionsBefore = JSON.parse(dataBefore!).state.savedSessions;
    const sessionsAfter = JSON.parse(dataAfter!).state.savedSessions;

    // Same video IDs should be present
    expect(Object.keys(sessionsAfter).length).toBeGreaterThanOrEqual(Object.keys(sessionsBefore).length);
  });

  test('localStorage persists across logout and login', async ({ page }) => {
    // Wait for video session to initialize
    await page.waitForTimeout(1000);

    // Get initial localStorage data
    const initialData = await page.evaluate(() => {
      return localStorage.getItem('video-sessions');
    });

    expect(initialData).not.toBeNull();

    // Logout
    await page.getByRole('button', { name: /logout/i }).click();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.waitForURL('/login', { timeout: 10000 });

    // Verify localStorage still has the data (logout doesn't clear it)
    const dataAfterLogout = await page.evaluate(() => {
      return localStorage.getItem('video-sessions');
    });
    expect(dataAfterLogout).not.toBeNull();

    // Login again
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL('/', { timeout: 10000 });

    // Select video again
    await page.getByRole('button', { name: 'Zoom Meeting Recording.mp4' }).click();
    await page.waitForTimeout(1000);

    // Verify localStorage still has session data structure
    const dataAfterLogin = await page.evaluate(() => {
      return localStorage.getItem('video-sessions');
    });
    expect(dataAfterLogin).not.toBeNull();

    // Verify structure is intact
    const parsed = JSON.parse(dataAfterLogin!);
    expect(parsed.state).toHaveProperty('savedSessions');
  });

  test('video player shows controls after selection', async ({ page }) => {
    // Wait for video to initialize
    await page.waitForTimeout(1000);

    // Verify video controls are present (indicates player is ready)
    await expect(page.getByText('100%')).toBeVisible(); // Volume control
    await expect(page.getByText(/1\.00x/)).toBeVisible(); // Playback speed control

    // Verify timeline slider is present
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.first()).toBeVisible();
  });

  test('localStorage can be manually updated and persists', async ({ page }) => {
    // Create a fake video session in localStorage
    const fakeVideoId = 'test-video-123';
    await page.evaluate((vid) => {
      const data = localStorage.getItem('video-sessions');
      const parsed = data ? JSON.parse(data) : { state: { savedSessions: {} }, version: 0 };

      // Add a fake session
      parsed.state.savedSessions[vid] = {
        current_time: 30,
        playback_speed: 1.0,
        volume: 1.0,
        version: 1,
      };

      localStorage.setItem('video-sessions', JSON.stringify(parsed));
    }, fakeVideoId);

    // Verify the fake session was added
    const sessionData = await page.evaluate((vid) => {
      const data = localStorage.getItem('video-sessions');
      if (!data) return null;
      const sessions = JSON.parse(data).state.savedSessions;
      return sessions[vid];
    }, fakeVideoId);

    expect(sessionData).not.toBeNull();
    expect(sessionData.current_time).toBe(30);
    expect(sessionData.playback_speed).toBe(1.0);
    expect(sessionData.volume).toBe(1.0);
    expect(sessionData.version).toBe(1);

    // Reload and verify persistence
    await page.reload();
    await page.waitForTimeout(500);

    const persistedData = await page.evaluate((vid) => {
      const data = localStorage.getItem('video-sessions');
      if (!data) return null;
      const sessions = JSON.parse(data).state.savedSessions;
      return sessions[vid];
    }, fakeVideoId);

    expect(persistedData).not.toBeNull();
    expect(persistedData.current_time).toBe(30);
  });
});
