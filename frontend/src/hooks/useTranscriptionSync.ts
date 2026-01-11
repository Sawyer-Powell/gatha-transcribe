import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { createWebSocketConnection, type WebSocketConnection } from '../services/websocket';

export interface UseTranscriptionSyncOptions {
  videoId: string;
  enabled?: boolean;
}

export interface UseTranscriptionSyncReturn {
  /**
   * Send playback position update to server
   */
  sendPlaybackUpdate: (currentTime: number) => void;

  /**
   * Current time from store (synced with server)
   */
  currentTime: number;

  /**
   * Whether the local state has unsaved changes
   */
  isDirty: boolean;
}

/**
 * Hook to manage transcription state synchronization via WebSocket
 *
 * - Connects to WebSocket on mount
 * - Sends playback updates (throttled)
 * - Receives StateSync from server
 * - Integrates with transcription store
 */
export function useTranscriptionSync(
  options: UseTranscriptionSyncOptions
): UseTranscriptionSyncReturn {
  const { videoId, enabled = true } = options;
  const wsRef = useRef<WebSocketConnection | null>(null);
  const lastSentTime = useRef<number>(0);
  const { currentTime, dirty, setVideoId, markClean } =
    useTranscriptionStore();

  // Set video ID when component mounts or video ID changes
  useEffect(() => {
    setVideoId(videoId);
  }, [videoId, setVideoId]);

  // Create WebSocket connection
  useEffect(() => {
    if (!enabled || !videoId) return;

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const wsUrl = baseUrl.replace(/^http/, 'ws');

    const connection = createWebSocketConnection({
      url: `${wsUrl}/ws/${videoId}`,
      onStatusChange: (status) => {
        console.log('WebSocket status:', status.state);
      },
      stateSyncTimeout: 5000,
      onStateSyncTimeout: () => {
        console.warn(
          'StateSync not received from server within 5 seconds. ' +
          'Using local state. Server may be overloaded or connection may be slow.'
        );
      },
    });

    wsRef.current = connection;

    return () => {
      connection.disconnect();
      wsRef.current = null;
    };
  }, [enabled, videoId]);

  /**
   * Send playback update to server (throttled to 500ms)
   */
  const sendPlaybackUpdate = useCallback(
    (time: number) => {
      const now = Date.now();
      const timeSinceLastSent = now - lastSentTime.current;

      // Throttle updates to 500ms
      if (timeSinceLastSent < 500) {
        return;
      }

      if (wsRef.current) {
        wsRef.current.send({
          type: 'UpdatePlaybackPosition',
          current_time: time,
        });

        lastSentTime.current = now;

        // Mark as clean since we just synced to server
        markClean();
      }
    },
    [markClean]
  );

  return {
    sendPlaybackUpdate,
    currentTime,
    isDirty: dirty,
  };
}
