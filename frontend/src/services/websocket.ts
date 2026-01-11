import type { ServerMessage } from '../types/ServerMessage';

export type ConnectionStatus =
  | { state: 'connected' }
  | { state: 'disconnected' }
  | { state: 'connecting' }
  | { state: 'waiting-to-reconnect', reconnectAt: number, attempt: number };

export interface WebSocketConfig {
  url: string;
  onStatusChange: (status: ConnectionStatus) => void;
  onMessage?: (message: ServerMessage) => void;
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  // For testing - inject dependencies
  WebSocketConstructor?: typeof WebSocket;
  dateNow?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export function handleMessage(message: ServerMessage) {
  switch (message.type) {
    case 'TestMessage':
      console.log('Received from server:', message.text);
      break;
  }
}

export function calculateBackoffDelay(
  retryCount: number,
  initialDelay: number,
  maxDelay: number
): number {
  const delay = initialDelay * Math.pow(2, retryCount);
  return Math.min(delay, maxDelay);
}

export function createWebSocketConnection(config: WebSocketConfig): () => void {
  const {
    url,
    onStatusChange,
    onMessage = handleMessage,
    maxRetries = Infinity,
    initialRetryDelay = 1000,
    maxRetryDelay = 30000,
    WebSocketConstructor = WebSocket,
    dateNow = () => Date.now(),
    setTimeoutFn = (fn, ms) => window.setTimeout(fn, ms),
    clearTimeoutFn = (id) => window.clearTimeout(id),
  } = config;

  let ws: WebSocket | null = null;
  let retryCount = 0;
  let retryTimeout: number | null = null;
  let shouldReconnect = true;
  let manualDisconnect = false;

  function connect() {
    if (!shouldReconnect) return;

    // Only show 'connecting' state on initial connection, not during retries
    if (retryCount === 0) {
      onStatusChange({ state: 'connecting' });
    }
    ws = new WebSocketConstructor(url);

    ws.onopen = () => {
      console.log('WebSocket connected');
      retryCount = 0; // Reset retry count on successful connection
      onStatusChange({ state: 'connected' });
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      onStatusChange({ state: 'disconnected' });

      // Only retry if not manually disconnected and haven't exceeded max retries
      if (!manualDisconnect && shouldReconnect && retryCount < maxRetries) {
        const delay = calculateBackoffDelay(retryCount, initialRetryDelay, maxRetryDelay);
        const reconnectAt = dateNow() + delay;
        console.log(`Reconnecting in ${delay}ms (attempt ${retryCount + 1})`);

        onStatusChange({
          state: 'waiting-to-reconnect',
          reconnectAt,
          attempt: retryCount + 1
        });

        retryTimeout = setTimeoutFn(() => {
          retryCount++;
          connect();
        }, delay) as unknown as number;
      }
    };
  }

  // Start initial connection
  connect();

  // Return cleanup function
  return () => {
    manualDisconnect = true;
    shouldReconnect = false;

    if (retryTimeout !== null) {
      clearTimeoutFn(retryTimeout);
      retryTimeout = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }
  };
}
