import { useState, useRef, useEffect } from "react";
import { WavRecorder, WavStreamPlayer } from "@openai/wavtools";

export function useRecording({ setPendingUpload }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }));
  const wavPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }));
  const [isDonnaConnected, setIsDonnaConnected] = useState(false);

  useEffect(() => {
    return () => {
      wavRecorderRef.current.quit();
      wavPlayerRef.current.interrupt();
    };
  }, []);

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

  const initDonnaAudio = async () => {
    try {
      await wavRecorderRef.current.begin();
      await wavPlayerRef.current.connect();
      setIsDonnaConnected(true);
    } catch (err) {
      console.error("Donna Audio Error:", err);
    }
  };

  const startDonnaMic = async (onAudioData) => {
    await wavRecorderRef.current.record((data) => {
      if (onAudioData) onAudioData(data.mono);
    });
  };

  const stopDonnaMic = async () => {
    await wavRecorderRef.current.pause();
  };

  const playDonnaAudio = (binaryDelta) => {
    wavPlayerRef.current.add16BitPCM(binaryDelta, "message");
  };

  return { 
    isRecording, 
    startRecording, 
    stopRecording,
    isDonnaConnected,
    initDonnaAudio,
    startDonnaMic,
    stopDonnaMic,
    playDonnaAudio,
    wavPlayerRef
  };
}