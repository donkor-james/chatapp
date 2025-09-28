// useWebSocket.js - Fixed URL construction and token handling

import { useEffect, useRef, useCallback } from "react";

const useWebSocket = (url, onMessage, options = {}) => {
  const ws = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const {
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    debug = false,
  } = options;

  const reconnectAttempts = useRef(0);
  const isIntentionallyClosed = useRef(false);

  const log = useCallback(
    (message, data = "") => {
      if (debug) console.log(`[WebSocket ${url}] ${message}`, data);
    },
    [url, debug]
  );

  const connect = useCallback(() => {
    if (!url) {
      log("No URL provided, skipping connection");
      return;
    }

    if (
      ws.current?.readyState === WebSocket.CONNECTING ||
      ws.current?.readyState === WebSocket.OPEN
    ) {
      log("WebSocket already connecting/connected");
      return;
    }

    try {
      log("Attempting to connect...");

      // Get token from localStorage
      const token = localStorage.getItem("access_token");

      if (!token) {
        log("ERROR: No access token found in localStorage");
        console.error("WebSocket connection failed: No access token available");
        return;
      }

      log("Token found:", token.substring(0, 20) + "...");

      // Construct WebSocket URL properly
      const protocol = "ws:"; // Use 'wss:' for HTTPS
      const backendHost = "localhost:8000"; // Your Django backend

      // Make sure URL starts with /
      const cleanUrl = url.startsWith("/") ? url : `/${url}`;

      // Build complete WebSocket URL with token as query parameter
      const wsUrl = `${protocol}//${backendHost}/ws${cleanUrl}?token=${encodeURIComponent(
        token
      )}`;

      log("Connecting to WebSocket URL:", wsUrl.replace(token, "TOKEN_HIDDEN"));

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        log("✅ Connected successfully");
        reconnectAttempts.current = 0;
        isIntentionallyClosed.current = false;
      };

      ws.current.onmessage = (event) => {
        console.log("🔥 RAW WebSocket onmessage event:", event);
        console.log("🔥 Raw event.data:", event.data);

        try {
          const data = JSON.parse(event.data);
          console.log("🔥 Parsed WebSocket data:", data);
          log("📨 Message received:", data);
          onMessage(data);
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
          console.error("❌ Raw data that failed to parse:", event.data);
          log("❌ Error parsing message:", error);
          console.error("WebSocket message parsing error:", error);
        }
      };

      ws.current.onclose = (event) => {
        log("❌ Connection closed:", {
          code: event.code,
          reason: event.reason,
          wasCleanClose: event.wasClean,
        });

        // Handle specific close codes
        switch (event.code) {
          case 4001:
            log("🔒 Authentication failed");
            console.error("WebSocket authentication failed. Check your token.");
            break;
          case 4003:
            log("🚫 Forbidden - not authorized for this resource");
            break;
          case 1006:
            log("🔌 Abnormal closure - connection lost");
            break;
        }

        // Don't reconnect if intentionally closed or max attempts reached
        if (
          isIntentionallyClosed.current ||
          reconnectAttempts.current >= maxReconnectAttempts ||
          event.code === 4001 || // Auth failure
          event.code === 4003
        ) {
          // Forbidden
          log(
            "🛑 Not reconnecting - intentionally closed, auth failed, or max attempts reached"
          );
          return;
        }

        // Only reconnect for network errors or unexpected closures
        if (event.code === 1006 || event.code === 1000) {
          reconnectAttempts.current++;
          log(
            `🔄 Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.current.onerror = (error) => {
        log("❌ WebSocket error:", error);
        console.error("WebSocket connection error:", error);
      };
    } catch (error) {
      log("❌ Connection error:", error);
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [url, onMessage, reconnectInterval, maxReconnectAttempts, log]);

  const disconnect = useCallback(() => {
    log("🔌 Disconnecting...");
    isIntentionallyClosed.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (ws.current) {
      ws.current.close(1000, "Intentional disconnect");
      ws.current = null;
    }
  }, [log]);

  const sendMessage = useCallback(
    (message) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        try {
          const messageStr = JSON.stringify(message);
          ws.current.send(messageStr);
          log("📤 Message sent:", message);
        } catch (error) {
          log("❌ Error sending message:", error);
          console.error("Failed to send WebSocket message:", error);
        }
      } else {
        log(
          "❌ Cannot send message - WebSocket not connected. State:",
          ws.current?.readyState
        );
        console.warn("Cannot send WebSocket message: connection not open");
      }
    },
    [log]
  );

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return { sendMessage, disconnect, connect };
};

export default useWebSocket;
