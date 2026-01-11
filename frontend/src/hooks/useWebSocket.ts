import { useEffect, useState } from 'react';
import { createWebSocketConnection, type ConnectionStatus } from '../services/websocket';

export function useWebSocket(url: string = 'ws://localhost:3000/ws') {
  const [status, setStatus] = useState<ConnectionStatus>({ state: 'connecting' });

  useEffect(() => {
    const cleanup = createWebSocketConnection({
      url,
      onStatusChange: setStatus,
    });

    return cleanup;
  }, [url]);

  return { status };
}
