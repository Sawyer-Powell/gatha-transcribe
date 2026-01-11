import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { LoginPage } from './LoginPage';

// Mock Button component to avoid dependency issues
vi.mock('../components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// Mock preact-iso
vi.mock('preact-iso', () => ({
  useLocation: () => ({
    route: vi.fn(),
  }),
}));

// Mock auth store
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    user: null,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the login form when user is not authenticated', () => {
    const { container } = render(<LoginPage />);

    // Check that the login page is rendered - looking for heading
    expect(screen.getByRole('heading', { name: /Login/i })).toBeInTheDocument();

    // Check that the email input is present (by type since labels aren't connected)
    const emailInput = container.querySelector('input[type="email"]');
    expect(emailInput).toBeInTheDocument();

    // Check that the password input is present
    const passwordInput = container.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();

    // Check that submit button exists with type submit
    const submitButtons = screen.getAllByRole('button').filter(btn => btn.getAttribute('type') === 'submit');
    expect(submitButtons.length).toBeGreaterThan(0);
  });

  it('should show both Login and Register tab buttons', () => {
    render(<LoginPage />);

    // Get all buttons
    const buttons = screen.getAllByRole('button');

    // Should have at least 3 buttons (Login tab, Register tab, Submit button)
    expect(buttons.length).toBeGreaterThanOrEqual(3);

    // Check that we have Login and Register text somewhere in the buttons
    const buttonTexts = buttons.map(btn => btn.textContent);
    expect(buttonTexts.filter(text => text?.includes('Login')).length).toBeGreaterThan(0);
    expect(buttonTexts.filter(text => text?.includes('Register')).length).toBeGreaterThan(0);
  });

  it('should not show name field on login tab by default', () => {
    const { container } = render(<LoginPage />);

    // Name field should not be present on login tab (default state)
    // Check by looking for "Name" text in labels
    expect(screen.queryByText(/^Name$/)).not.toBeInTheDocument();
  });
});
