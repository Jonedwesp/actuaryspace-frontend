import { useState, useRef, useEffect } from "react";

// Inject a custom worklet directly via Blob to avoid Vite public folder issues
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      const pcm16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

export function useRecording({ setPendingUpload }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [isDonnaConnected, setIsDonnaConnected] = useState(false);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const nextPlayTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Standard Voice Note Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const audioFile = new File([audioBlob], "voice-note.mp3", { type: "audio/mp3" });
        if (setPendingUpload) setPendingUpload({ file: audioFile, kind: "file" });
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Agent Donna Real-time Web Audio Logic
  const initDonnaAudio = async () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = ctx;

      const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(workletUrl);
      
      setIsDonnaConnected(true);
    } catch (err) {
      console.error("Donna Audio Error:", err);
    }
  };
const startDonnaMic = async (onAudioData) => {
    if (!audioCtxRef.current) return;
    try {
      await audioCtxRef.current.resume();

     const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      micStreamRef.current = stream;
      
      const audioTrack = stream.getAudioTracks()[0];
      console.log("[Donna] Using microphone device:", audioTrack.label);
      
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtxRef.current, 'pcm-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        // e.data is the raw ArrayBuffer containing Int16Array
        if (onAudioData) onAudioData(e.data);
      };

      source.connect(workletNode);
      workletNode.connect(audioCtxRef.current.destination);
    } catch (err) {
      console.error("Donna Mic Error:", err);
    }
  };

  const stopDonnaMic = async () => {
    if (workletNodeRef.current) workletNodeRef.current.disconnect();
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  };

  const playDonnaAudio = (base64Audio) => {
    if (!audioCtxRef.current) return;
    
    // Convert Base64 delta to Int16Array, then to Float32Array for Web Audio API
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
    }

    const buffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtxRef.current.destination);

    // Schedule playback seamlessly
    const currentTime = audioCtxRef.current.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }
    
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;
  };

  return { 
    isRecording, 
    startRecording, 
    stopRecording,
    isDonnaConnected,
    initDonnaAudio,
    startDonnaMic,
    stopDonnaMic,
    playDonnaAudio
  };
}