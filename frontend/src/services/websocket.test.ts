import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    readyState: number = 0; // CONNECTING
    onopen: ((event: any) => void) | null = null;
    onclose: ((event: any) => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    sentMessages: string[] = [];

    constructor(url: string) {
      this.url = url;
      mockWs = this;
    }

    send(data: string) {
      this.sentMessages.push(data);
    }

    close() {
      this.readyState = 3; // CLOSED
      if (this.onclose) this.onclose({});
    }

    simulateOpen() {
      this.readyState = 1; // OPEN
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
    const connection = createConnection();

    expect(statusChanges[0]).toEqual({ state: 'connecting' });

    mockWs.simulateOpen();
    expect(statusChanges[1]).toEqual({ state: 'connected' });

    mockWs.simulateMessage({ type: 'TestMessage', text: 'Hello' });
    expect(messages[0]).toEqual({ type: 'TestMessage', text: 'Hello' });

    connection.disconnect();
  });

  it('should send messages when connected', () => {
    const connection = createConnection();

    mockWs.simulateOpen();

    connection.send({
      type: 'UpdatePlaybackPosition',
      current_time: 42.5,
    });

    expect(mockWs.sentMessages).toHaveLength(1);
    expect(JSON.parse(mockWs.sentMessages[0])).toEqual({
      type: 'UpdatePlaybackPosition',
      current_time: 42.5,
    });

    connection.disconnect();
  });

  it('should handle StateSync messages', () => {
    const connection = createConnection();

    mockWs.simulateOpen();

    // Simulate StateSync message from server
    mockWs.simulateMessage({
      type: 'StateSync',
      session: { current_time: 100.5 },
    });

    expect(messages[0]).toEqual({
      type: 'StateSync',
      session: { current_time: 100.5 },
    });

    connection.disconnect();
  });

  it('should reconnect with exponential backoff', () => {
    const connection = createConnection({ initialRetryDelay: 1000 });

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

    connection.disconnect();
  });

  it('should cleanup and stop reconnecting', () => {
    const connection = createConnection({ initialRetryDelay: 100 });

    mockWs.simulateOpen();
    mockWs.close();

    // Should have 2 timers: reconnect + StateSync timeout (not cleared until reconnect)
    expect(timers.size).toBeGreaterThanOrEqual(1);

    connection.disconnect();

    expect(timers.size).toBe(0);
  });

  it('should timeout if StateSync not received', () => {
    const timeoutCallback = vi.fn();
    const connection = createConnection({
      stateSyncTimeout: 2000,
      onStateSyncTimeout: timeoutCallback,
    });

    mockWs.simulateOpen();

    // StateSync timeout should be set
    expect(timers.size).toBe(1);

    // Run timeout
    runTimers(2000);

    // Callback should be called
    expect(timeoutCallback).toHaveBeenCalledOnce();

    connection.disconnect();
  });

  it('should cancel timeout when StateSync received', () => {
    const timeoutCallback = vi.fn();
    const connection = createConnection({
      stateSyncTimeout: 2000,
      onStateSyncTimeout: timeoutCallback,
    });

    mockWs.simulateOpen();

    // Send StateSync message
    mockWs.simulateMessage({
      type: 'StateSync',
      session: { current_time: 0 },
    });

    // Timeout should be cleared
    expect(timers.size).toBe(0);

    // Run the timer that would have fired
    runTimers(2000);

    // Callback should NOT be called
    expect(timeoutCallback).not.toHaveBeenCalled();

    connection.disconnect();
  });

  it('should reset StateSync flag on reconnection', () => {
    const timeoutCallback = vi.fn();
    const connection = createConnection({
      stateSyncTimeout: 2000,
      onStateSyncTimeout: timeoutCallback,
      initialRetryDelay: 100,
    });

    mockWs.simulateOpen();

    // Receive StateSync
    mockWs.simulateMessage({
      type: 'StateSync',
      session: { current_time: 0 },
    });

    // Disconnect and reconnect
    mockWs.close();
    runTimers(100);
    mockWs.simulateOpen();

    // Should start new timeout on reconnection
    expect(timers.size).toBe(1);

    // Run timeout
    runTimers(2000);

    // Should timeout because StateSync not received after reconnection
    expect(timeoutCallback).toHaveBeenCalledOnce();

    connection.disconnect();
  });
});
