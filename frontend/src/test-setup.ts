import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import * as preactCompat from 'preact/compat';

expect.extend(matchers);

// Make React globally available for preact/compat's lazy() and Suspense
// This is needed because some compat features check for global React
(globalThis as any).React = preactCompat;
