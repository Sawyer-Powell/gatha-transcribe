import { describe, it, expect, beforeEach } from 'vitest';
import { createWebSocketConnection, type ConnectionStatus, calculateBackoffDelay } from './websocket';
import type { ServerMessage } from '../types/ServerMessage';

describe('calculateBackoffDelay', () => {
  it('should calculate exponential backoff with capping', () => {
    expect(calculateBackoffDelay(0, 1000, 30000)).toBe(1000);
    expect(calculateBackoffDelay(1, 1000, 30000)).toBe(2000);
    expect(calculateBackoffDelay(2, 1000, 30000)).toBe(4000);
    expect(calculateBackoffDelay(10, 1000, 30000)).toBe(30000);
  });
});

describe('createWebSocketConnection', () => {
  let mockWs: any;
  let statusChanges: ConnectionStatus[];
  let messages: ServerMessage[];
  let timers: Map<number, { fn: () => void; ms: number }>;
  let timerIdCounter: number;
  let currentTime: number;

  class MockWebSocket {
    url: string;
    onopen: ((event: any) => void) | null = null;
    onclose: ((event: any) => void) | null = null;
    onmessage: ((event: any) => void) | null = null;

    constructor(url: string) {
      this.url = url;
      mockWs = this;
    }

    close() {
      if (this.onclose) this.onclose({});
    }

    simulateOpen() {
      if (this.onopen) this.onopen({});
    }

    simulateMessage(data: any) {
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify(data) });
      }
    }
  }

  const mockSetTimeout = (fn: () => void, ms: number): number => {
    const id = timerIdCounter++;
    timers.set(id, { fn, ms });
    return id;
  };

  const mockClearTimeout = (id: number): void => {
    timers.delete(id);
  };

  const runTimers = (ms: number) => {
    Array.from(timers.entries())
      .filter(([_, timer]) => timer.ms <= ms)
      .forEach(([id, timer]) => {
        timers.delete(id);
        timer.fn();
      });
  };

  beforeEach(() => {
    statusChanges = [];
    messages = [];
    timers = new Map();
    timerIdCounter = 1;
    currentTime = 1000000;
    mockWs = null;
  });

  const createConnection = (config = {}) => {
    return createWebSocketConnection({
      url: 'ws://localhost:3000/ws',
      onStatusChange: (status: ConnectionStatus) => statusChanges.push(status),
      onMessage: (message: ServerMessage) => messages.push(message),
      WebSocketConstructor: MockWebSocket as any,
      dateNow: () => currentTime,
      setTimeoutFn: mockSetTimeout as any,
      clearTimeoutFn: mockClearTimeout as any,
      ...config,
    });
  };

  it('should connect and handle messages', () => {
    const cleanup = createConnection();

    expect(statusChanges[0]).toEqual({ state: 'connecting' });

    mockWs.simulateOpen();
    expect(statusChanges[1]).toEqual({ state: 'connected' });

    mockWs.simulateMessage({ type: 'TestMessage', text: 'Hello' });
    expect(messages[0]).toEqual({ type: 'TestMessage', text: 'Hello' });

    cleanup();
  });

  it('should reconnect with exponential backoff', () => {
    const cleanup = createConnection({ initialRetryDelay: 1000 });

    mockWs.simulateOpen();
    mockWs.close();

    // First retry - 1s delay
    expect(statusChanges[statusChanges.length - 1]).toMatchObject({
      state: 'waiting-to-reconnect',
      attempt: 1,
      reconnectAt: currentTime + 1000,
    });

    runTimers(1000);
    mockWs.close();

    // Second retry - 2s delay
    expect(statusChanges[statusChanges.length - 1]).toMatchObject({
      state: 'waiting-to-reconnect',
      attempt: 2,
      reconnectAt: currentTime + 2000,
    });

    cleanup();
  });

  it('should cleanup and stop reconnecting', () => {
    const cleanup = createConnection({ initialRetryDelay: 100 });

    mockWs.simulateOpen();
    mockWs.close();

    expect(timers.size).toBe(1);

    cleanup();

    expect(timers.size).toBe(0);
  });
});
