/**
 * Centralized configuration for API and WebSocket URLs
 *
 * Uses window.location.origin to work correctly with:
 * - localhost:3000
 * - 127.0.0.1:3000
 * - Production domains
 */

function getBaseUrl(): string {
  // Use environment variable if set (for development overrides)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Default to current origin (works for localhost, 127.0.0.1, and production)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Fallback for SSR/build time
  return 'http://localhost:3000';
}

export const BASE_URL = getBaseUrl();

export const WS_URL = BASE_URL.replace(/^http/, 'ws');
