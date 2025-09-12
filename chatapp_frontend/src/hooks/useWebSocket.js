import { useRef, useState, useEffect, useCallback } from "react";

const WS_BASE_URL = "ws://localhost:8000/ws";

const useWebSocket = (url, onMessage) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || !url) return;

    ws.current = new WebSocket(`${WS_BASE_URL}${url}?token=${token}`);

    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    return () => {
      ws.current?.close();
    };
  }, [url, onMessage]);

  const sendMessage = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return { sendMessage, isConnected };
};

export default useWebSocket;
