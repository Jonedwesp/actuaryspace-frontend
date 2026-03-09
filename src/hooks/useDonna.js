import { useState, useCallback, useRef, useEffect } from "react";

export function useDonna({
  instructions,
  tools,
  onSpeechStart,
  onTranscription,
  onResponseStart,
  onResponseDelta,
  onFunctionCall,
  onError,
}) {
  const [isConnected, setIsConnected] = useState(false);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const isConnectingRef = useRef(false);

  // Keep callbacks and config current without causing reconnects
  const callbacksRef = useRef({});
  useEffect(() => {
    callbacksRef.current = { onSpeechStart, onTranscription, onResponseStart, onResponseDelta, onFunctionCall, onError };
  }, [onSpeechStart, onTranscription, onResponseStart, onResponseDelta, onFunctionCall, onError]);

  const configRef = useRef({ instructions, tools });
  useEffect(() => {
    configRef.current = { instructions, tools };
  }, [instructions, tools]);

  const disconnectDonna = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    setIsConnected(false);
    isConnectingRef.current = false;
  }, []);

  const connectDonna = useCallback(async () => {
    if (isConnectingRef.current || pcRef.current) return;
    isConnectingRef.current = true;

    try {
      // 1. Get ephemeral token from backend
      const res = await fetch("/.netlify/functions/realtime-token");
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
      const data = await res.json();
      const ephemeralKey = data.client_secret?.value;
      if (!ephemeralKey) throw new Error("No ephemeral key in response");

      // 2. Create WebRTC peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 3. Play Donna's audio response via a hidden audio element
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

      // 4. Add mic track so Donna can hear you
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 5. Data channel for events (transcriptions, function calls, etc.)
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setIsConnected(true);
        isConnectingRef.current = false;
        console.log("[Donna] WebRTC connected");

        // Configure session
        const { instructions: inst, tools: tls } = configRef.current;
        const flatTools = (tls || []).map(t => ({
          type: "function",
          name: t.function?.name || t.name,
          description: t.function?.description || t.description,
          parameters: t.function?.parameters || t.parameters,
        }));

        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            instructions: inst || "You are Agent Donna, a professional actuarial assistant.",
            modalities: ["text", "audio"],
            voice: "alloy",
            input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.4,
              silence_duration_ms: 600,
            },
            tools: flatTools,
            tool_choice: "auto",
          },
        }));
      };

      dc.onmessage = (e) => {
        let event;
        try { event = JSON.parse(e.data); } catch { return; }

        const cb = callbacksRef.current;
        const t = event.type;

        if (t !== "input_audio_buffer.append") {
          console.log("[Donna Event]:", t, event);
        }

        if (t === "input_audio_buffer.speech_started") {
          cb.onSpeechStart?.();
        } else if (t === "conversation.item.input_audio_transcription.completed") {
          cb.onTranscription?.(event.transcript);
        } else if (t === "response.created") {
          cb.onResponseStart?.();
        } else if (t === "response.audio_transcript.delta" || t === "response.text.delta") {
          cb.onResponseDelta?.(event.delta);
        } else if (t === "response.function_call_arguments.done") {
          let args = {};
          try { args = JSON.parse(event.arguments); } catch {}
          cb.onFunctionCall?.({ name: event.name, args, call_id: event.call_id });
        } else if (t === "error") {
          cb.onError?.(event.error?.message || "Unknown error");
        }
      };

      dc.onclose = () => {
        console.log("[Donna] Disconnected");
        setIsConnected(false);
        pcRef.current?.close();
        pcRef.current = null;
        dcRef.current = null;
        isConnectingRef.current = false;
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed" || state === "disconnected") {
          console.warn("[Donna] WebRTC connection", state);
          disconnectDonna();
        }
      };

      // 6. SDP exchange with OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        throw new Error(`SDP exchange failed: ${sdpRes.status} - ${errText}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      console.log("[Donna] SDP exchange complete");

    } catch (error) {
      console.error("[Donna] Connection error:", error);
      isConnectingRef.current = false;
      pcRef.current?.close();
      pcRef.current = null;
    }
  }, [disconnectDonna]);

  return { isConnected, connectDonna, disconnectDonna };
}
