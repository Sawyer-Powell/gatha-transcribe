import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
}

interface AppLocalState {
  // UI State (persisted to localStorage)
  selectedVideoId: string | null;
  splitSizes: [number, number];

  // Auth State (not persisted - auth via HTTP-only cookies)
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface AppLocalActions {
  // UI Actions
  setSelectedVideoId: (videoId: string | null) => void;
  setSplitSizes: (sizes: [number, number]) => void;

  // Auth Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export type AppLocalStore = AppLocalState & AppLocalActions;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SPLIT_SIZES: [number, number] = [70, 30];
const API_BASE_URL = 'http://localhost:3000';

// ============================================================================
// Store
// ============================================================================

export const useAppLocalStore = create<AppLocalStore>()(
  persist(
    (set) => ({
      // UI State
      selectedVideoId: null,
      splitSizes: DEFAULT_SPLIT_SIZES,

      // Auth State
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      // UI Actions
      setSelectedVideoId: (videoId) => set({ selectedVideoId: videoId }),
      setSplitSizes: (sizes) => set({ splitSizes: sizes }),

      // Auth Actions
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      checkAuth: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            set({ user: data, isInitialized: true });
          } else {
            // 401 is expected when not logged in
            set({ user: null, isInitialized: true });
          }
        } catch (error) {
          console.warn('Auth check failed:', error);
          set({ user: null, isInitialized: true });
        }
      },

      login: async (email, password) => {
        set({ error: null, isLoading: true });
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Login failed');
          }

          const data = await response.json();
          set({ user: data.user, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      register: async (name, email, password) => {
        set({ error: null, isLoading: true });
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, password }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Registration failed');
          }

          const data = await response.json();
          set({ user: data.user, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
          set({ user: null });
        } catch (error) {
          console.error('Logout failed:', error);
        }
      },
    }),
    {
      name: 'app-local-storage',
      // Only persist UI state, not auth state (auth via cookies)
      partialize: (state) => ({
        selectedVideoId: state.selectedVideoId,
        splitSizes: state.splitSizes,
      }),
    }
  )
);

// ============================================================================
// Selectors (for convenience)
// ============================================================================

export const selectUser = (s: AppLocalStore) => s.user;
export const selectIsAuthenticated = (s: AppLocalStore) => s.user !== null;
export const selectIsInitialized = (s: AppLocalStore) => s.isInitialized;
export const selectSelectedVideoId = (s: AppLocalStore) => s.selectedVideoId;
export const selectSplitSizes = (s: AppLocalStore) => s.splitSizes;
