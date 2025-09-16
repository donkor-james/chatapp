import { useRef, useState, useEffect, useCallback } from "react";

const WS_BASE_URL = "ws://localhost:8000/ws";

const useWebSocket = (url, onMessage) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || !url) return;

    ws.current = new WebSocket(`${WS_BASE_URL}${url}?token=${token}`);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log(
        "WebSocket connected:",
        `${WS_BASE_URL}${url}?token=${token}`
      );
    };
    ws.current.onclose = () => {
      setIsConnected(false);
      console.log(
        "WebSocket disconnected:",
        `${WS_BASE_URL}${url}?token=${token}`
      );
    };
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket received:", data);
      onMessage(data);
    };

    return () => {
      ws.current?.close();
    };
  }, [url, onMessage]);

  const sendMessage = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket sending:", message);
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not open. Message not sent:", message);
    }
  }, []);

  return { sendMessage, isConnected };
};

export default useWebSocket;
