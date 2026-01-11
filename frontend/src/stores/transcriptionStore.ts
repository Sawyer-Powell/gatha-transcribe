import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TranscriptionState {
  // Current playback position in seconds
  currentTime: number;

  // Dirty flag: true when local state has unsaved changes
  dirty: boolean;

  // Video ID for the current session
  videoId: string | null;
}

export interface TranscriptionActions {
  // Set current playback time (marks as dirty)
  setCurrentTime: (time: number) => void;

  // Sync state from server (only if not dirty)
  syncFromServer: (serverState: Partial<TranscriptionState>) => void;

  // Mark state as clean (after successful sync to server)
  markClean: () => void;

  // Set video ID (resets state)
  setVideoId: (videoId: string) => void;

  // Reset entire state
  reset: () => void;
}

export type TranscriptionStore = TranscriptionState & TranscriptionActions;

const initialState: TranscriptionState = {
  currentTime: 0,
  dirty: false,
  videoId: null,
};

export const useTranscriptionStore = create<TranscriptionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      setCurrentTime: (time: number) => {
        set({ currentTime: time, dirty: true });
      },

      syncFromServer: (serverState: Partial<TranscriptionState>) => {
        const { dirty } = get();

        // Only accept server state if local state is clean
        if (!dirty) {
          set({
            ...serverState,
            dirty: false, // Server state is authoritative, so not dirty
          });
        }
        // If dirty, ignore server updates (local changes take priority)
      },

      markClean: () => {
        set({ dirty: false });
      },

      setVideoId: (videoId: string) => {
        // Reset state when changing videos
        set({
          ...initialState,
          videoId,
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'transcription-storage', // localStorage key
      // Only persist these fields (dirty flag is transient)
      partialize: (state) => ({
        currentTime: state.currentTime,
        videoId: state.videoId,
      }),
    }
  )
);
