import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { App } from './app';

// Mock components with navigation capabilities
vi.mock('./pages/LoginPage', () => ({
  LoginPage: () => {
    return (
      <div data-testid="login-page">
        <h1>Login Page</h1>
        <a href="/">Go to Home</a>
      </div>
    );
  },
}));

vi.mock('./features/transcriber', () => ({
  Transcriber: () => <div data-testid="transcriber">Transcriber Page</div>,
}));

// Create a mock store that we can control
let mockUser: any = null;
let mockIsInitialized = true;

vi.mock('./stores/authStore', () => ({
  useAuthStore: (selector: any) => {
    const store = {
      checkAuth: vi.fn(),
      user: mockUser,
      isInitialized: mockIsInitialized,
      isLoading: false,
      error: null,
    };
    return selector ? selector(store) : store;
  },
}));

describe('Routing Integration', () => {
  beforeEach(() => {
    mockUser = null;
    mockIsInitialized = true;
    vi.clearAllMocks();
  });

  it('should redirect from / to /login when not authenticated', async () => {
    window.history.pushState({}, '', '/');

    render(<App />);

    // Should redirect to login page
    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    }, { timeout: 2000 });
  });

  it('should render empty div while checking authentication', async () => {
    mockIsInitialized = false;

    window.history.pushState({}, '', '/');

    const { container } = render(<App />);

    // Should render but with empty content (no loading screen flash)
    // The route transition wrapper should be present
    expect(container.querySelector('.route-transition')).toBeInTheDocument();
  });

  it('should allow access to / when authenticated', async () => {
    mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };

    window.history.pushState({}, '', '/');

    render(<App />);

    // Should render the transcriber page
    await waitFor(() => {
      expect(screen.getByTestId('transcriber')).toBeInTheDocument();
    });
  });

  it('should allow unauthenticated access to /login', () => {
    window.history.pushState({}, '', '/login');

    render(<App />);

    // Login page should render immediately without redirect
    expect(screen.getAllByTestId('login-page').length).toBeGreaterThan(0);
  });
});
