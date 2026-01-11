import { lazy, Suspense } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { Router, Route, LocationProvider } from 'preact-iso';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './stores/authStore';
import './app.css';

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
      <Transcriber videoPath='/Zoom Meeting Recording (1).mp4' />
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
    <LocationProvider>
      <Router>
        <Route path="/login" component={LoginRoute} />
        <Route path="/" component={ProtectedTranscriberRoute} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}
