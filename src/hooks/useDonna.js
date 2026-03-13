import { useState, useCallback, useRef, useEffect } from "react";

export function useDonna({
  instructions,
  tools,
  onTranscription,
  onResponseDelta,
  onResponseEnd,
  onAudioDone,
  onFunctionCall,
  onSpeechStart,
  onError,
  // 🛡️ ARCHITECT'S FIX: Accept the ignore ref from App.jsx
  ignoreNextDonnaRef,
}) {
  const [isConnected, setIsConnected] = useState(false);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const isConnectingRef = useRef(false);
  const lastResponseIdRef = useRef(null);
  const lastUserItemIdRef = useRef(null);
  const audioAnalyserRef = useRef(null);
  const silenceRafRef = useRef(null);

  // 🛡️ ARCHITECT'S SHIELD: Prevents background pollers from overwriting Donna's active Trello changes
  const pendingDonnaLabelsRef = useRef({}); // Format: { [cardId]: { labelId, expires } }

  // 🚀 Helper to manually lock a card's labels or fields for 45 seconds
  const markLabelPending = useCallback((cardId, labelId, fieldName = 'Priority') => {
    pendingDonnaLabelsRef.current[cardId] = {
      labelId,    // This can be a label ID or a field value (e.g., "Urgent")
      fieldName,  // e.g., "Priority"
      expires: Date.now() + 45000 
    };
    console.log(`[Shield] Card ${cardId} (${fieldName}) is now protected for 45s`);
  }, []);

  // Keep callbacks and config current without causing reconnects
  const callbacksRef = useRef({});
  useEffect(() => {
    callbacksRef.current = { onTranscription, onResponseDelta, onResponseEnd, onAudioDone, onFunctionCall, onSpeechStart, onError };
  }, [onTranscription, onResponseDelta, onResponseEnd, onFunctionCall, onSpeechStart, onError]);

  const configRef = useRef({ instructions, tools });
  useEffect(() => {
    configRef.current = { instructions, tools };
  }, [instructions, tools]);

  const disconnectDonna = useCallback(() => {
    cancelAnimationFrame(silenceRafRef.current);
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    audioAnalyserRef.current = null;
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

      // 3. Play Donna's audio response via a stable audio element
      let audioEl = document.getElementById("donna-audio");
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.id = "donna-audio";
        audioEl.autoplay = true;
        audioEl.style.display = "none";
        document.body.appendChild(audioEl);
      }
      pc.ontrack = (e) => {
        const stream = (e.streams && e.streams[0]) ? e.streams[0] : new MediaStream([e.track]);
        audioEl.srcObject = stream;
        audioEl.play().catch(err => console.warn("[Donna] Audio play blocked:", err));

        // Set up Web Audio analyser so we can detect actual playback silence
        try {
          const ctx = new AudioContext();
          ctx.resume().catch(() => {});
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.3;
          src.connect(analyser);
          audioAnalyserRef.current = analyser;
        } catch (err) {
          console.warn("[Donna] Analyser setup failed:", err);
        }
      };

      // 4. Add mic track — falls back to silent track if mic is denied (OpenAI requires audio in SDP)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      } catch (micErr) {
        console.warn("[Donna] Mic unavailable, using silent track for text-only mode:", micErr.message);
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        dest.stream.getTracks().forEach(track => pc.addTrack(track, dest.stream));
      }

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
            modalities: ["text"],
            // Fallback OpenAI voice (if ElevenLabs quota runs out): voice: "marin", speed: 1.4 — re-enable and switch modalities to ["text","audio"]
            input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5, // 🚀 ARCHITECT'S FIX: Lower threshold to make her less jumpy/sensitive to clicks
              prefix_padding_ms: 300,
              silence_duration_ms: 1500, // 🚀 Wait longer (1.5s) before assuming Siya is done speaking
              create_response: false, // 🛡️ NEVER auto-respond — we manually trigger after wake-word check
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
        }

        // Track the latest user audio item ID so we can delete it if no wake word
        if (t === "conversation.item.created" && event.item?.role === "user") {
          lastUserItemIdRef.current = event.item.id;
        }

        if (t === "conversation.item.input_audio_transcription.completed") {
          // 🛡️ ECHO SHIELD: If Donna is currently responding or we just approved an action, 
          // ignore any transcriptions to prevent loops.
          if (ignoreNextDonnaRef?.current) return;
          cb.onTranscription?.(event.transcript);
        } else if (t === "response.audio_transcript.delta" || t === "response.text.delta") {
          // 🚀 ARCHITECT'S DELTA LOCK:
          // Ensure we don't mix transcript deltas from the server (which can happen in text-only mode)
          const delta = event.delta || event.text;
          if (!delta) return;

          const isNew = event.response_id !== lastResponseIdRef.current;
          lastResponseIdRef.current = event.response_id;
          cb.onResponseDelta?.(delta, isNew);
        } else if (t === "response.function_call_arguments.done") {
          let args = {};
          try { args = JSON.parse(event.arguments); } catch {}
          cb.onFunctionCall?.({
            name: event.name,
            args,
            call_id: event.call_id
          });
        } else if (t === "response.audio.done") {
          // Audio transmission finished — poll the actual stream for silence before firing onAudioDone
          cancelAnimationFrame(silenceRafRef.current);
          const analyser = audioAnalyserRef.current;
          if (!analyser) {
            setTimeout(() => callbacksRef.current.onAudioDone?.(), 800);
          } else {
            const buf = new Uint8Array(analyser.frequencyBinCount);
            let silentSince = null;
            const poll = () => {
              analyser.getByteFrequencyData(buf);
              const peak = Math.max(...buf);
              if (peak < 6) {
                if (!silentSince) silentSince = Date.now();
                else if (Date.now() - silentSince > 400) {
                  callbacksRef.current.onAudioDone?.();
                  return;
                }
              } else {
                silentSince = null;
              }
              silenceRafRef.current = requestAnimationFrame(poll);
            };
            silenceRafRef.current = requestAnimationFrame(poll);
          }
        } else if (t === "response.done") {
          // Clear any audio buffered during Donna's response (prevents echo re-submission)
          setTimeout(() => {
            if (dcRef.current?.readyState === "open") {
              dcRef.current.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
            }
          }, 300);
          cb.onResponseEnd?.();
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

  const sendSessionUpdate = useCallback((updates) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "session.update", session: updates }));
    }
  }, []);

  const sendToolResponse = useCallback((callId, output) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(output),
        },
      }));
      dcRef.current.send(JSON.stringify({ type: "response.create" }));
    }
  }, []);

  const sendText = useCallback((text) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      }));
      dcRef.current.send(JSON.stringify({ type: "response.create" }));
    }
  }, []);

  // 🛡️ Manually trigger a response — called only after wake-word is confirmed
  const sendResponseCreate = useCallback(() => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "response.create" }));
    }
  }, []);

  // 🚀 ARCHITECT'S KILL SWITCH: Stops Donna's current thought and audio immediately
  const cancelResponse = useCallback(() => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "response.cancel" }));
    }
  }, []);

  // 🗑️ Delete the last user audio item — called when no wake word detected (keeps conversation clean)
  const deleteLastUserItem = useCallback(() => {
    const itemId = lastUserItemIdRef.current;
    if (itemId && dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({
        type: "conversation.item.delete",
        item_id: itemId,
      }));
      lastUserItemIdRef.current = null;
    }
  }, []);

  return {
    isConnected,
    connectDonna,
    disconnectDonna,
    sendSessionUpdate,
    sendToolResponse,
    sendText,
    sendResponseCreate,
    cancelResponse, 
    deleteLastUserItem,
    // 🛡️ NEW: Return the shield and the marker so useTrello and App.jsx can see them
    pendingDonnaLabelsRef,
    markLabelPending,
    pcRef,
    dcRef,
  };
}
