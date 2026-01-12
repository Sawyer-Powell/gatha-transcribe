/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { App } from './app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
declare const require: (module: string) => any;

// Create a mock store that we can control
let mockUser: any = null;
let mockIsInitialized = true;
const mockCheckAuth = vi.fn();

// Mock react-query to avoid React hook issues
vi.mock('@tanstack/react-query', () => {
  class MockQueryClient {}
  return {
    QueryClient: MockQueryClient,
    QueryClientProvider: ({ children }: { children: any }) => children,
    useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: () => {} }),
    useMutation: () => ({ mutate: () => {}, isLoading: false }),
  };
});

// Mock components
vi.mock('./pages/LoginPage', () => ({
  LoginPage: function MockLoginPage() {
    const { h } = require('preact');
    return h('div', { 'data-testid': 'login-page' },
      h('h1', null, 'Login Page'),
      h('a', { href: '/' }, 'Go to Home')
    );
  },
}));

vi.mock('./features/transcriber', () => ({
  Transcriber: function MockTranscriber() {
    const { h } = require('preact');
    return h('div', { 'data-testid': 'transcriber' }, 'Transcriber Page');
  },
}));

vi.mock('./stores/appLocalStore', () => ({
  useAppLocalStore: (selector: any) => {
    const store = {
      checkAuth: mockCheckAuth,
      user: mockUser,
      isInitialized: mockIsInitialized,
      isLoading: false,
      error: null,
      selectedVideoId: null,
      splitSizes: [70, 30],
      setSelectedVideoId: vi.fn(),
      setSplitSizes: vi.fn(),
    };
    return selector ? selector(store) : store;
  },
}));

describe('App & Routing', () => {
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

    // Should render but with minimal content while auth is initializing
    // ProtectedRoute returns empty div when not initialized
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBeGreaterThan(0);

    // Should not show transcriber or login content yet
    expect(screen.queryByTestId('transcriber')).not.toBeInTheDocument();
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

  it('should render without crashing', () => {
    // Smoke test - catches cyclic structure errors and basic rendering issues
    expect(() => render(<App />)).not.toThrow();
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
