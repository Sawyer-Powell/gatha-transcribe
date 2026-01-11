import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { Router, Route, LocationProvider } from 'preact-iso';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './stores/authStore';
import './app.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const Transcriber = lazy(() => import('./features/transcriber').then(m => ({ default: m.Transcriber })));

// Route components
const LoginRoute = () => (
  <Suspense fallback={<div />}>
    <LoginPage />
  </Suspense>
);

const ProtectedTranscriberRoute = () => (
  <ProtectedRoute>
    <Suspense fallback={<div />}>
      <Transcriber />
    </Suspense>
  </ProtectedRoute>
);

const NotFound = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-lg">404 - Route not found</div>
  </div>
);

export function App() {
  const checkAuth = useAuthStore(state => state.checkAuth);

  // Check auth once when app loads
  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <Router>
          <Route path="/login" component={LoginRoute} />
          <Route path="/" component={ProtectedTranscriberRoute} />
          <Route default component={NotFound} />
        </Router>
      </LocationProvider>
    </QueryClientProvider>
  );
}
