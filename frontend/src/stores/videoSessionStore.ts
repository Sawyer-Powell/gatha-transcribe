import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ServerMessage } from '../types/ServerMessage';
import type { ClientMessage } from '../types/ClientMessage';
import type { SessionState } from '../types/SessionState';
import { WS_URL } from '../config';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'IDLE' | 'LOADING' | 'RESOLVING' | 'SEEKING' | 'READY';

export interface VideoMetadata {
  width: number | null;
  height: number | null;
  duration: number | null;
}

// Callbacks for video element coordination
export interface SessionCallbacks {
  onSeekTo?: (time: number) => void;
  onPlaybackSpeedChange?: (speed: number) => void;
  onVolumeChange?: (volume: number) => void;
}

// Dependency injection for testing
export interface StoreDependencies {
  WebSocketConstructor?: typeof WebSocket;
  dateNow?: () => number;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}

// ============================================================================
// Store State & Actions
// ============================================================================

export interface VideoSessionState {
  // Session identity
  videoId: string | null;

  // State machine
  state: ConnectionState;
  gates: {
    wsConnected: boolean;
    stateSyncReceived: boolean;
    videoCanPlay: boolean;
  };

  // Video state (versioned - synced to server, uses snake_case to match wire format)
  current_time: number;
  playback_speed: number;
  volume: number;
  version: number;
  metadata: VideoMetadata | null;

  // Server state for conflict resolution (uses snake_case to match wire format)
  serverState: SessionState | null;

  // Persisted sessions (per-video localStorage cache, uses snake_case to match wire format)
  savedSessions: Record<string, SessionState>;
}

export interface VideoSessionActions {
  // Session lifecycle
  initSession: (videoId: string, callbacks?: SessionCallbacks) => void;
  destroySession: () => void;

  // Video element notifications
  notifyVideoCanPlay: () => void;
  notifySeekComplete: () => void;

  // Playback updates (triggers localStorage + WebSocket sync)
  updateTime: (time: number) => void;

  // Playback preferences (local-only, persisted to localStorage)
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;

  // Internal actions (exposed for flexibility)
  setMetadata: (metadata: VideoMetadata) => void;

  // For testing: inject dependencies
  _setDependencies: (deps: StoreDependencies) => void;
}

export type VideoSessionStore = VideoSessionState & VideoSessionActions;

// ============================================================================
// Initial State
// ============================================================================

// Default values for playback preferences
const DEFAULT_PLAYBACK_SPEED = 1.0;
const DEFAULT_VOLUME = 1.0;

const initialSessionState: Omit<VideoSessionState, 'savedSessions'> = {
  videoId: null,
  state: 'IDLE',
  gates: {
    wsConnected: false,
    stateSyncReceived: false,
    videoCanPlay: false,
  },
  current_time: 0,
  playback_speed: DEFAULT_PLAYBACK_SPEED,
  volume: DEFAULT_VOLUME,
  version: 0,
  metadata: null,
  serverState: null,
};

// ============================================================================
// Module-level state (WebSocket instance, not reactive)
// ============================================================================

let ws: WebSocket | null = null;
let callbacks: SessionCallbacks = {};
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let stateSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSentTime = 0;
let retryCount = 0;

// Dependency injection defaults
let deps: StoreDependencies = {
  WebSocketConstructor: typeof WebSocket !== 'undefined' ? WebSocket : undefined,
  dateNow: () => Date.now(),
  setTimeout: globalThis.setTimeout?.bind(globalThis),
  clearTimeout: globalThis.clearTimeout?.bind(globalThis),
};

// Constants
const SEND_THROTTLE_MS = 500;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const STATE_SYNC_TIMEOUT = 5000;

// ============================================================================
// Logger
// ============================================================================

function log(videoId: string | null, ...args: unknown[]) {
  const shortId = videoId?.slice(0, 8) ?? 'none';
  console.log(`[VideoSession:${shortId}]`, ...args);
}

// ============================================================================
// WebSocket Management
// ============================================================================

function calculateBackoff(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY);
}

function connectWebSocket(
  videoId: string,
  get: () => VideoSessionStore,
  set: (partial: Partial<VideoSessionState>) => void
): void {
  const WS = deps.WebSocketConstructor;
  if (!WS) {
    log(videoId, 'WebSocket not available');
    return;
  }

  const url = `${WS_URL}/ws/${videoId}`;

  log(videoId, `Connecting to ${url}`);

  ws = new WS(url);

  ws.onopen = () => {
    log(videoId, 'WebSocket connected');
    retryCount = 0;

    const store = get();
    if (!store.gates.wsConnected) {
      log(videoId, 'Gate: WS_CONNECTED ✓');
      set({ gates: { ...store.gates, wsConnected: true } });
      checkGates(get, set);
    }

    // Start StateSync timeout
    if (stateSyncTimeout) deps.clearTimeout!(stateSyncTimeout);
    stateSyncTimeout = deps.setTimeout!(() => {
      const s = get();
      if (!s.gates.stateSyncReceived) {
        log(s.videoId, 'WARNING: StateSync timeout');
      }
    }, STATE_SYNC_TIMEOUT);
  };

  ws.onmessage = (event) => {
    try {
      const message: ServerMessage = JSON.parse(event.data);
      handleServerMessage(message, get, set);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onclose = () => {
    log(videoId, 'WebSocket disconnected');
    ws = null;

    // Reconnect if session still active
    const store = get();
    if (store.videoId === videoId && store.state !== 'IDLE') {
      const delay = calculateBackoff(retryCount);
      log(videoId, `Reconnecting in ${delay}ms (attempt ${retryCount + 1})`);

      reconnectTimeout = deps.setTimeout!(() => {
        retryCount++;
        if (get().videoId === videoId) {
          connectWebSocket(videoId, get, set);
        }
      }, delay);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// ============================================================================
// Server Message Handler Registry
// ============================================================================

type MessageHandlerContext = {
  get: () => VideoSessionStore;
  set: (partial: Partial<VideoSessionState>) => void;
};

type ServerMessageHandlers = {
  [K in ServerMessage['type']]?: (
    data: Extract<ServerMessage, { type: K }>,
    ctx: MessageHandlerContext
  ) => void;
};

const serverMessageHandlers: ServerMessageHandlers = {
  StateSync: ({ session }, { get, set }) => {
    if (stateSyncTimeout) {
      deps.clearTimeout!(stateSyncTimeout);
      stateSyncTimeout = null;
    }

    const { current_time, playback_speed, volume, version } = session;
    const store = get();
    log(store.videoId, `Gate: STATE_SYNC ✓ (server v=${version}, t=${current_time}, speed=${playback_speed}, vol=${volume})`);
    set({
      serverState: session,
      gates: { ...store.gates, stateSyncReceived: true },
    });
    checkGates(get, set);
  },

  VideoMetadata: ({ width, height, duration_seconds }, { get, set }) => {
    log(get().videoId, `Metadata: ${width}x${height}, duration=${duration_seconds}`);
    set({ metadata: { width, height, duration: duration_seconds } });
  },

  TestMessage: ({ text }, { get }) => {
    log(get().videoId, `Test message: ${text}`);
  },
};

function handleServerMessage(
  message: ServerMessage,
  get: () => VideoSessionStore,
  set: (partial: Partial<VideoSessionState>) => void
): void {
  log(get().videoId, `Received: ${message.type}`);

  const handler = serverMessageHandlers[message.type];
  if (handler) {
    // Type assertion needed due to discriminated union complexity
    (handler as (msg: ServerMessage, ctx: MessageHandlerContext) => void)(
      message,
      { get, set }
    );
  }
}

// ============================================================================
// Generic WebSocket Send Helper
// ============================================================================

function send(message: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Throttled send for frequent updates (e.g., playback position during playback)
function sendThrottled(message: ClientMessage): void {
  const now = deps.dateNow!();
  if (now - lastSentTime < SEND_THROTTLE_MS) return;
  send(message);
  lastSentTime = now;
}

// ============================================================================
// Generic State Update Helper
// ============================================================================

type SyncableFields = Pick<VideoSessionState, 'current_time' | 'playback_speed' | 'volume'>;

function updateAndSync(
  get: () => VideoSessionStore,
  set: (partial: Partial<VideoSessionState>) => void,
  updates: Partial<SyncableFields>,
  sendFn?: (store: VideoSessionStore, newVersion: number) => void
): void {
  const store = get();
  if (store.state !== 'READY' || !store.videoId) return;

  const newVersion = store.version + 1;
  const newState = {
    current_time: updates.current_time ?? store.current_time,
    playback_speed: updates.playback_speed ?? store.playback_speed,
    volume: updates.volume ?? store.volume,
  };

  set({
    ...updates,
    version: newVersion,
    savedSessions: {
      ...store.savedSessions,
      [store.videoId]: { ...newState, version: newVersion },
    },
  });

  sendFn?.(store, newVersion);
}

function disconnectWebSocket(): void {
  if (reconnectTimeout) {
    deps.clearTimeout!(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (stateSyncTimeout) {
    deps.clearTimeout!(stateSyncTimeout);
    stateSyncTimeout = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  retryCount = 0;
  lastSentTime = 0;
}

// ============================================================================
// State Machine
// ============================================================================

function checkGates(
  get: () => VideoSessionStore,
  set: (partial: Partial<VideoSessionState>) => void
): void {
  const store = get();
  if (store.state !== 'LOADING') return;

  const { wsConnected, stateSyncReceived, videoCanPlay } = store.gates;
  log(store.videoId, `Gates: WS=${wsConnected}, StateSync=${stateSyncReceived}, CanPlay=${videoCanPlay}`);

  if (wsConnected && stateSyncReceived && videoCanPlay) {
    resolve(get, set);
  }
}

function resolve(
  get: () => VideoSessionStore,
  set: (partial: Partial<VideoSessionState>) => void
): void {
  const store = get();
  if (!store.serverState) return;

  set({ state: 'RESOLVING' });
  log(store.videoId, 'State: LOADING → RESOLVING');

  const local = {
    current_time: store.current_time,
    playback_speed: store.playback_speed,
    volume: store.volume,
    version: store.version
  };
  const server = store.serverState;

  log(store.videoId, `Resolving: local(v=${local.version}, t=${local.current_time.toFixed(1)}) vs server(v=${server.version}, t=${server.current_time.toFixed(1)})`);

  let seekTarget: number | null = null;

  // Resolved state after conflict resolution
  let resolvedSpeed = local.playback_speed;
  let resolvedVolume = local.volume;

  if (local.version > server.version) {
    log(store.videoId, `Local wins (v${local.version} > v${server.version}) → push to server`);
    send({
      type: 'SyncState',
      current_time: local.current_time,
      playback_speed: local.playback_speed,
      volume: local.volume,
      version: local.version,
    });
    if (local.current_time > 0) {
      seekTarget = local.current_time;
    }
  } else if (server.version > local.version) {
    log(store.videoId, `Server wins (v${server.version} > v${local.version}) → accept server`);
    // Accept server state fully (including playback preferences)
    const newSavedSessions = store.videoId
      ? {
          ...store.savedSessions,
          [store.videoId]: server,
        }
      : store.savedSessions;
    set({
      current_time: server.current_time,
      playback_speed: server.playback_speed,
      volume: server.volume,
      version: server.version,
      savedSessions: newSavedSessions,
    });
    resolvedSpeed = server.playback_speed;
    resolvedVolume = server.volume;
    if (server.current_time > 0) {
      seekTarget = server.current_time;
    }
  } else {
    log(store.videoId, `Versions equal (v${local.version}) → in sync`);
    if (local.current_time > 0) {
      seekTarget = local.current_time;
    }
  }

  // Always apply resolved playback preferences to video element
  callbacks.onPlaybackSpeedChange?.(resolvedSpeed);
  callbacks.onVolumeChange?.(resolvedVolume);

  if (seekTarget !== null) {
    set({ state: 'SEEKING' });
    log(store.videoId, `State: RESOLVING → SEEKING (target=${seekTarget.toFixed(1)})`);
    callbacks.onSeekTo?.(seekTarget);
  } else {
    set({ state: 'READY' });
    log(store.videoId, 'State: RESOLVING → READY');
  }
}

// ============================================================================
// Store Creator
// ============================================================================

const storeCreator: StateCreator<VideoSessionStore> = (set, get) => ({
  ...initialSessionState,
  savedSessions: {},

  initSession: (videoId, cbs) => {
    const store = get();

    // Clean up previous session
    if (ws || store.videoId) {
      log(store.videoId, 'Cleaning up previous session');
      disconnectWebSocket();
    }

    callbacks = cbs ?? {};

    // Load from savedSessions
    const saved = store.savedSessions[videoId];

    log(videoId, `Init: saved=${saved ? `v${saved.version}, t=${saved.current_time.toFixed(1)}, speed=${saved.playback_speed}, vol=${saved.volume}` : 'none'}`);

    set({
      ...initialSessionState,
      savedSessions: store.savedSessions, // Preserve
      videoId,
      current_time: saved?.current_time ?? 0,
      playback_speed: saved?.playback_speed ?? DEFAULT_PLAYBACK_SPEED,
      volume: saved?.volume ?? DEFAULT_VOLUME,
      version: saved?.version ?? 0,
      state: 'LOADING',
    });

    log(videoId, 'State: IDLE → LOADING');

    // Connect WebSocket
    connectWebSocket(videoId, get, set);
  },

  destroySession: () => {
    const store = get();
    log(store.videoId, 'Destroying session');
    disconnectWebSocket();
    callbacks = {};
    set({
      ...initialSessionState,
      savedSessions: store.savedSessions, // Preserve
    });
  },

  notifyVideoCanPlay: () => {
    const store = get();
    log(store.videoId, 'Gate: VIDEO_CANPLAY ✓');
    set({ gates: { ...store.gates, videoCanPlay: true } });
    checkGates(get, set);
  },

  notifySeekComplete: () => {
    const store = get();
    if (store.state === 'SEEKING') {
      log(store.videoId, 'Seek complete');
      set({ state: 'READY' });
      log(store.videoId, 'State: SEEKING → READY');
    }
  },

  updateTime: (time) => updateAndSync(get, set,
    { current_time: time },
    (_, v) => sendThrottled({ type: 'UpdatePlaybackPosition', current_time: time, version: v })
  ),

  setPlaybackSpeed: (speed) => updateAndSync(get, set,
    { playback_speed: speed },
    (_, v) => send({ type: 'UpdatePlaybackSpeed', playback_speed: speed, version: v })
  ),

  setVolume: (vol) => updateAndSync(get, set,
    { volume: vol },
    (_, v) => send({ type: 'UpdateVolume', volume: vol, version: v })
  ),

  setMetadata: (metadata) => {
    set({ metadata });
  },

  _setDependencies: (newDeps) => {
    deps = { ...deps, ...newDeps };
  },
});

// ============================================================================
// Store with Persist Middleware
// ============================================================================

export const useVideoSessionStore = create<VideoSessionStore>()(
  persist(storeCreator, {
    name: 'video-sessions',
    partialize: (state) => ({ savedSessions: state.savedSessions }),
  })
);

// ============================================================================
// Selectors
// ============================================================================

export const selectVideoId = (s: VideoSessionStore) => s.videoId;
export const selectConnectionState = (s: VideoSessionStore) => s.state;
export const selectCurrentTime = (s: VideoSessionStore) => s.current_time;
export const selectPlaybackSpeed = (s: VideoSessionStore) => s.playback_speed;
export const selectVolume = (s: VideoSessionStore) => s.volume;
export const selectVersion = (s: VideoSessionStore) => s.version;
export const selectMetadata = (s: VideoSessionStore) => s.metadata;
export const selectGates = (s: VideoSessionStore) => s.gates;
export const selectIsReady = (s: VideoSessionStore) => s.state === 'READY';
