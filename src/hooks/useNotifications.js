import { useState, useRef, useEffect } from "react";
import { formatNotificationDate } from "../utils/dateTime.js";
import { GMAIL_SOUND_DATA, GCHAT_SOUND_DATA, TRELLO_SOUND_DATA, CALENDAR_SOUND_DATA } from "../utils/soundData.js";

export function useNotifications({ sessionStartTime }) {
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [exitingNotifIds, setExitingNotifIds] = useState(new Set());
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem("NOTIF_MUTED") === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem("NOTIF_MUTED", isMuted);
  }, [isMuted]);

  const seenGmailIdsRef = useRef(null);
  const seenGchatIdsRef = useRef(null);
  const soundedGmailIdsRef = useRef(new Set());
  const dismissedNotifsRef = useRef(new Set(JSON.parse(localStorage.getItem("DISMISSED_NOTIFS") || "[]")));

  // Global notification listener (Calendar, Trash, Trello, etc.)
  useEffect(() => {
    const handleNotify = (e) => {
      const n = e.detail;
      if (!n) return;
      const id = n.id || `notif-${Date.now()}-${Math.random()}`;
      const isHistorical = new Date(n.timestamp) < sessionStartTime.current;
      if (isHistorical || dismissedNotifsRef.current.has(id)) return;

      if (!isMuted) {
        console.log(`[Audio Engine] Playing sound for: ${n.alt}`);
        const soundSource = n.alt === "Gmail" ? GMAIL_SOUND_DATA :
                            n.alt === "Google Chat" ? GCHAT_SOUND_DATA :
                            n.alt === "Trello" ? TRELLO_SOUND_DATA :
                            n.alt === "Calendar" ? CALENDAR_SOUND_DATA : null;
        if (soundSource) {
          const audio = new Audio(soundSource);
          audio.play().catch(err => console.warn(`[Audio Engine] ${n.alt} sound blocked. Interaction needed.`, err));
        }
      }

      if (n.alt === "Google Chat" && seenGchatIdsRef.current) seenGchatIdsRef.current.add(id);
      if (n.alt === "Gmail" && seenGmailIdsRef.current) seenGmailIdsRef.current.add(id);

      setNotifications(prev => {
        if (prev.some(p => p.id === id)) return prev;
        const mapped = {
          ...n,
          id,
          time: formatNotificationDate(n.timestamp || new Date().toISOString())
        };
        const next = [mapped, ...prev].sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return next.slice(0, 100);
      });
    };
    window.addEventListener("notify", handleNotify);
    return () => window.removeEventListener("notify", handleNotify);
  }, [isMuted]);

  // Global button bounce + audio priming on every click
  useEffect(() => {
    const handleClick = (e) => {
      const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
      silentAudio.play().catch(() => {});
      if (e.target.closest('.gchat-menu-wrap')) return;
      const btn = e.target.closest('button');
      if (!btn) return;
      btn.classList.remove('btn-bounce');
      void btn.offsetWidth;
      btn.classList.add('btn-bounce');
      btn.addEventListener('animationend', () => btn.classList.remove('btn-bounce'), { once: true });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return {
    notifications, setNotifications,
    notifLoading, setNotifLoading,
    exitingNotifIds, setExitingNotifIds,
    isMuted, setIsMuted,
    seenGmailIdsRef,
    seenGchatIdsRef,
    soundedGmailIdsRef,
    dismissedNotifsRef,
  };
}