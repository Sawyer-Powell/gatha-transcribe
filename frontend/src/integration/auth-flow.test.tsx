import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { App } from '../app';
import { spawn, ChildProcess } from 'child_process';

/**
 * Full-stack integration tests that spin up a real backend server
 * with in-memory SQLite database and test the complete auth flow.
 *
 * These tests would have caught:
 * - Cyclic structure errors (app wouldn't render)
 * - CORS issues
 * - Cookie handling problems
 * - Route redirect issues
 */

let backendServer: ChildProcess | null = null;
const BACKEND_PORT = 3001;

describe.skip('Full-Stack Auth Integration', () => {
  beforeAll(async () => {
    // Start the test backend server
    backendServer = spawn(
      'cargo',
      ['run', '--bin', 'test-server'],
      {
        env: {
          ...process.env,
          PORT: BACKEND_PORT.toString(),
          RUST_LOG: 'info',
        },
        cwd: '../../', // Adjust to your backend directory
      }
    );

    // Wait for server to be ready
    await new Promise((resolve) => {
      backendServer?.stdout?.on('data', (data) => {
        if (data.toString().includes('listening')) {
          resolve(true);
        }
      });

      // Fallback timeout
      setTimeout(resolve, 3000);
    });

    // Note: Auth store uses VITE_API_URL env variable
    // Tests will use real backend server at localhost:3001
  });

  afterAll(async () => {
    // Cleanup: kill backend server
    if (backendServer) {
      backendServer.kill();
    }
  });

  beforeEach(() => {
    // Clear cookies between tests
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });

    // Reset to login page
    window.history.pushState({}, '', '/login');
  });

  it('should complete full registration and login flow', async () => {
    const user = userEvent.setup();

    const { container } = render(<App />);

    // Wait for login page to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Login|Create Account/i })).toBeInTheDocument();
    });

    // Switch to register tab
    const registerTab = screen.getByRole('button', { name: /Register/i });
    await user.click(registerTab);

    // Fill in registration form
    const nameInput = container.querySelector('input[type="text"]');
    const emailInput = container.querySelector('input[type="email"]');
    const passwordInput = container.querySelector('input[type="password"]');

    if (!nameInput || !emailInput || !passwordInput) {
      throw new Error('Form inputs not found');
    }

    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    // Submit registration
    const submitButton = screen.getAllByRole('button').find(
      (btn) => btn.getAttribute('type') === 'submit'
    );
    if (!submitButton) {
      throw new Error('Submit button not found');
    }

    await user.click(submitButton);

    // Should redirect to home page after successful registration
    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/');
      },
      { timeout: 5000 }
    );

    // Should now be on the transcriber page (authenticated)
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Login/i })).not.toBeInTheDocument();
    });
  }, 10000); // Longer timeout for full integration

  it('should redirect to login when accessing protected route while unauthenticated', async () => {
    // Try to access home page without authentication
    window.history.pushState({}, '', '/');

    render(<App />);

    // Should redirect to login
    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/login');
      },
      { timeout: 3000 }
    );

    // Login page should be visible
    expect(screen.getByRole('heading', { name: /Login|Create Account/i })).toBeInTheDocument();
  });

  it('should handle login with invalid credentials', async () => {
    const user = userEvent.setup();

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Login/i })).toBeInTheDocument();
    });

    // Fill in login form with invalid credentials
    const emailInput = container.querySelector('input[type="email"]');
    const passwordInput = container.querySelector('input[type="password"]');

    if (!emailInput || !passwordInput) {
      throw new Error('Form inputs not found');
    }

    await user.type(emailInput, 'nonexistent@example.com');
    await user.type(passwordInput, 'wrongpassword');

    // Submit login
    const submitButton = screen.getAllByRole('button').find(
      (btn) => btn.getAttribute('type') === 'submit'
    );
    if (!submitButton) {
      throw new Error('Submit button not found');
    }

    await user.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials|Login failed/i)).toBeInTheDocument();
    });

    // Should still be on login page
    expect(window.location.pathname).toBe('/login');
  }, 10000);
});
