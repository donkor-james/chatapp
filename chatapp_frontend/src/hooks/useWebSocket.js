import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

export function useWebSocket(path, { onMessage, enabled = true } = {}) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!enabled || !path) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const url = `${WS_BASE}/ws/${path}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => console.log(`WS connected: ${path}`);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current?.(data);
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = (e) => {
      // Reconnect on unexpected close (not 4001/4003 auth errors)
      if (e.code !== 4001 && e.code !== 4003 && e.code !== 1000) {
        console.log(`WS closed (${e.code}), reconnecting in 3s…`);
        setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => console.error('WS error:', err);
  }, [path, enabled]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close(1000, 'component unmounted');
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
