import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { App } from './app';

// Mock the components to avoid complex dependencies
vi.mock('./pages/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock('./features/transcriber', () => ({
  Transcriber: () => <div data-testid="transcriber">Transcriber</div>,
}));

// Mock auth store
const mockCheckAuth = vi.fn();
vi.mock('./stores/authStore', () => ({
  useAuthStore: (selector: any) => {
    const store = {
      checkAuth: mockCheckAuth,
      user: null,
      isInitialized: true,
      isLoading: false,
      error: null,
    };
    return selector ? selector(store) : store;
  },
}));

describe('App', () => {
  it('should render without crashing', () => {
    // This test catches cyclic structure errors and basic rendering issues
    expect(() => render(<App />)).not.toThrow();
  });

  it('should render login page at /login route', async () => {
    // Set initial URL to /login
    window.history.pushState({}, '', '/login');

    render(<App />);

    // Wait for lazy loaded component to render
    await waitFor(() => {
      expect(screen.getAllByTestId('login-page').length).toBeGreaterThan(0);
    });
  });

  it('should render 404 for invalid routes', async () => {
    window.history.pushState({}, '', '/invalid-route');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/404/i)).toBeInTheDocument();
    });
  });

  it('should call checkAuth on mount', () => {
    render(<App />);
    expect(mockCheckAuth).toHaveBeenCalled();
  });
});
