import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TranscriberState {
  // Currently selected video ID
  selectedVideoId: string | null;

  // Global horizontal split sizes [leftPercent, rightPercent]
  splitSizes: [number, number];

  // Actions
  setSelectedVideoId: (videoId: string | null) => void;
  setSplitSizes: (sizes: [number, number]) => void;
}

const DEFAULT_SPLIT_SIZES: [number, number] = [70, 30];

export const useTranscriberStore = create<TranscriberState>()(
  persist(
    (set) => ({
      selectedVideoId: null,
      splitSizes: DEFAULT_SPLIT_SIZES,

      setSelectedVideoId: (videoId) => set({ selectedVideoId: videoId }),

      setSplitSizes: (sizes) => set({ splitSizes: sizes }),
    }),
    {
      name: 'transcriber-storage-v2', // localStorage key (v2 to avoid conflicts with old structure)
    }
  )
);
