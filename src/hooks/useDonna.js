import { useState, useRef, useCallback } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";

export function useDonna() {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef(null);

  const connectDonna = useCallback(async () => {
    try {
      const client = new RealtimeClient({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowAPIKeyInBrowser: true,
      });

      clientRef.current = client;

      client.on("realtime.event", (realtimeEvent) => {
        if (realtimeEvent.event.type === "session.created") {
          console.log("Donna Session Created / CONNECTED");
          setIsConnected(true);
        }
      });

      client.on("close", () => {
        console.log("Donna Disconnected");
        setIsConnected(false);
      });

      await client.connect();
      console.log("Handshake initiated...");
      
    } catch (error) {
      console.error("Donna Connection Error:", error);
    }
  }, []);

  const disconnectDonna = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
  }, []);

  return {
    isConnected,
    connectDonna,
    disconnectDonna,
    client: clientRef.current,
  };
}