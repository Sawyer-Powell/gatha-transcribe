import { useEffect, useState } from 'react';
import { createWebSocketConnection, type ConnectionStatus } from '../services/websocket';

export function useWebSocket(url: string = 'ws://localhost:3000/ws') {
  const [status, setStatus] = useState<ConnectionStatus>({ state: 'connecting' });

  useEffect(() => {
    const connection = createWebSocketConnection({
      url,
      onStatusChange: setStatus,
    });

    return () => connection.disconnect();
  }, [url]);

  return { status };
}
