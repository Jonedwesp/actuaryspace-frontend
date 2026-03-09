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
      const newClient = new RealtimeClient({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowAPIKeyInBrowser: true,
      });

      newClient.on("realtime.event", (realtimeEvent) => {
        const serverEvent = realtimeEvent.event;
        if (!serverEvent) return;

        if (serverEvent.type === "session.created") {
          console.log("Donna Session Created / CONNECTED");
          setIsConnected(true);
        }
        
        if (serverEvent.type === "response.audio.delta") {
          if (playAudioRef.current) {
            playAudioRef.current(serverEvent.delta);
          }
        }

        // Capture transcription from the server when a turn is finished
        if (serverEvent.type === 'conversation.item.input_audio_transcription.completed') {
          if (onTranscriptionRef.current) {
            onTranscriptionRef.current(`You: "${serverEvent.transcript}"`);
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