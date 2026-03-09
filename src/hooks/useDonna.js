import { useState, useCallback, useRef, useEffect } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";

export function useDonna({ playDonnaAudio, onTranscription }) {
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState(null);
  
  const playAudioRef = useRef(playDonnaAudio);
  const onTranscriptionRef = useRef(onTranscription);
  const isConnectingRef = useRef(false);
  const clientRef = useRef(null);
  
  useEffect(() => {
    playAudioRef.current = playDonnaAudio;
    onTranscriptionRef.current = onTranscription;
  }, [playDonnaAudio, onTranscription]);

const connectDonna = useCallback(async () => {
    if (isConnectingRef.current || clientRef.current) {
      return; // Already connecting or connected, ignore.
    }
    
    isConnectingRef.current = true;
    
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey) {
        console.error("🚨 CRITICAL: VITE_OPENAI_API_KEY is undefined! Check your .env file and restart the Vite server.");
      }

      const newClient = new RealtimeClient({
        apiKey: apiKey,
        dangerouslyAllowAPIKeyInBrowser: true,
        url: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      });

  newClient.on("realtime.event", (realtimeEvent) => {
      const serverEvent = realtimeEvent.event;
      if (!serverEvent) return;

      // Handle Connection State
      if (serverEvent.type === "session.created" || serverEvent.type === "session.updated") {
        console.log("[useDonna] Session Sync:", serverEvent.type);
        setIsConnected(true);
      }
      
      // Handle Incoming Audio
      if (serverEvent.type === "response.audio.delta") {
        if (playAudioRef.current) {
          playAudioRef.current(serverEvent.delta);
        }
      }

    });
      newClient.on("close", () => {
        console.log("Donna Disconnected");
        setIsConnected(false);
        setClient(null);
        clientRef.current = null;
        isConnectingRef.current = false;
      });

      await newClient.connect();
      setClient(newClient);
      clientRef.current = newClient;
      console.log("Handshake initiated...");
      
    } catch (error) {
      console.error("Donna Connection Error:", error);
      isConnectingRef.current = false;
    }
  }, []);

  const disconnectDonna = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      setClient(null);
      clientRef.current = null;
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, []);

  return {
    isConnected,
    connectDonna,
    disconnectDonna,
    client,
  };
}