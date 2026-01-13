# Frontend Development

Preact SPA with TypeScript, Zustand state, and TailwindCSS.

## Development

```bash
npm run dev          # Dev server (localhost:5173)
npm test             # Run tests
npm run build        # Build for production
```

## Architecture

```
src/
├── app.tsx          # Main app, routing
├── pages/           # Route pages (LoginPage)
├── features/        # Feature modules (transcriber)
├── components/      # Reusable UI
├── stores/          # Zustand stores (auth)
└── api/             # OpenAPI client
```

## Key Patterns

**Routing (preact-iso):**
- Named route components (avoid inline functions)
- Lazy loading for code splitting
- Protected routes with `<ProtectedRoute>`

**State (Zustand):**
- One store per domain (auth, transcriber)
- Actions colocated with state
- Selectors for derived state

**Code Style:**
- Simple functional components
- **NO classes** (use plain objects and functions)
- **NO module-level state**
- Pass state through props/context

**Example:**
```typescript
// ✅ Good
function VideoPlayer({ videoState, onUpdate }) {
  return <video src={videoState.url} />;
}

// ❌ Bad
class VideoPlayer {
  private state: VideoState;
}
```

## Authentication

- HTTP-only cookies (XSS protection)
- JWT with 30-day expiration
- `authStore.ts` manages state
- `checkAuth()` on app mount

## API Calls

Uses `openapi-fetch` with auto-generated types:
```typescript
import { client } from './api/client';

const { data } = await client.GET('/api/auth/me');
```

## Testing

- **Unit:** Vitest + @testing-library/preact
- **Focus:** High-value tests only
- **Pattern:** Test user interactions, not implementation

## Build Output

Lazy-loaded bundles:
- Initial: ~34 kB
- LoginPage: ~2 kB
- Transcriber: ~61 kB
