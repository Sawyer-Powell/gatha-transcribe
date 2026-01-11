import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(container.textContent).toContain('Test content');
  });

  it('should catch and display error', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('Test error');
  });

  it('should use custom fallback when provided', () => {
    const { container } = render(
      <ErrorBoundary fallback={(error) => <div>Custom error: {error.message}</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(container.textContent).toContain('Custom error: Test error');
  });

  it('should show reload button in default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const buttons = screen.getAllByRole('button');
    const reloadButton = buttons.find(btn => btn.textContent?.includes('Reload page'));
    expect(reloadButton).toBeDefined();
  });
});
