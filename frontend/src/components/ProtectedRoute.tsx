import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuthStore } from '../stores/authStore';
import type { ComponentChildren } from 'preact';

interface ProtectedRouteProps {
  children: ComponentChildren;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isInitialized } = useAuthStore();
  const location = useLocation();

  // Redirect to login if not authenticated (after initialization is complete)
  useEffect(() => {
    if (isInitialized && !user) {
      location.route('/login', true);
    }
  }, [isInitialized, user, location]);

  // While checking auth, render nothing (prevents flash during initialization)
  if (!isInitialized) {
    return <div />;
  }

  if (!user) {
    // Return empty div while redirecting
    return <div />;
  }

  return <>{children}</>;
};
