import { describe, it, expect, beforeEach } from 'vitest';
import { useTranscriptionStore } from './transcriptionStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('transcriptionStore', () => {
  beforeEach(() => {
    // Clear store and localStorage before each test
    useTranscriptionStore.getState().reset();
    localStorageMock.clear();
  });

  it('should initialize with default state', () => {
    const state = useTranscriptionStore.getState();

    expect(state.currentTime).toBe(0);
    expect(state.dirty).toBe(false);
    expect(state.videoId).toBe(null);
  });

  it('should set current time and mark as dirty', () => {
    const { setCurrentTime } = useTranscriptionStore.getState();

    setCurrentTime(42.5);

    const state = useTranscriptionStore.getState();
    expect(state.currentTime).toBe(42.5);
    expect(state.dirty).toBe(true);
  });

  it('should sync from server when not dirty', () => {
    const { syncFromServer } = useTranscriptionStore.getState();

    syncFromServer({ currentTime: 100.0 });

    const state = useTranscriptionStore.getState();
    expect(state.currentTime).toBe(100.0);
    expect(state.dirty).toBe(false);
  });

  it('should ignore server updates when dirty', () => {
    const { setCurrentTime, syncFromServer } = useTranscriptionStore.getState();

    // Make local change (marks as dirty)
    setCurrentTime(42.5);

    // Try to sync from server
    syncFromServer({ currentTime: 100.0 });

    // Should keep local value
    const state = useTranscriptionStore.getState();
    expect(state.currentTime).toBe(42.5);
    expect(state.dirty).toBe(true);
  });

  it('should accept server updates after marking clean', () => {
    const { setCurrentTime, markClean, syncFromServer } = useTranscriptionStore.getState();

    // Make local change
    setCurrentTime(42.5);

    // Mark as clean (simulating successful sync to server)
    markClean();

    // Now server update should be accepted
    syncFromServer({ currentTime: 100.0 });

    const state = useTranscriptionStore.getState();
    expect(state.currentTime).toBe(100.0);
    expect(state.dirty).toBe(false);
  });

  it('should reset state when setting new video ID', () => {
    const { setCurrentTime, setVideoId } = useTranscriptionStore.getState();

    // Make some changes
    setCurrentTime(42.5);

    // Change video
    setVideoId('new-video-123');

    const state = useTranscriptionStore.getState();
    expect(state.currentTime).toBe(0);
    expect(state.dirty).toBe(false);
    expect(state.videoId).toBe('new-video-123');
  });

  // Note: localStorage persistence is handled by zustand's persist middleware
  // and is already tested by zustand. We focus on business logic tests here.

  it('should handle multiple playback updates', () => {
    const { setCurrentTime } = useTranscriptionStore.getState();

    setCurrentTime(10.0);
    setCurrentTime(20.0);
    setCurrentTime(30.0);

    const state = useTranscriptionStore.getState();
    expect(state.currentTime).toBe(30.0);
    expect(state.dirty).toBe(true);
  });

  it('should handle reset', () => {
    const { setCurrentTime, setVideoId, reset } = useTranscriptionStore.getState();

    setVideoId('video-123');
    setCurrentTime(42.5);

    reset();

    const state = useTranscriptionStore.getState();
    expect(state.currentTime).toBe(0);
    expect(state.dirty).toBe(false);
    expect(state.videoId).toBe(null);
  });
});
