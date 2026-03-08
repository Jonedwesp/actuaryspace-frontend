import { useEffect } from "react";
import { GCHAT_ID_MAP } from "../utils/gchatUtils.js";
import { formatNotificationDate } from "../utils/dateTime.js";
import { GMAIL_SOUND_DATA, GCHAT_SOUND_DATA } from "../utils/soundData.js";
import gmailIcon from "../assets/Gmail pic.png";
import gchatIcon from "../assets/Google Chat.png";

export function useSyncPolling({
  isMuted,
  sessionStartTime,
  isInitialGmailSyncRef, isInitialGchatSyncRef,
  reportSystemError, clearSystemError,
  notifications, setNotifications, setNotifLoading,
  dismissedNotifsRef, seenGmailIdsRef, seenGchatIdsRef, soundedGmailIdsRef,
  setGmailEmails, activeFolderRef, activeSearchRef, gmailPageRef,
  gchatSpaces, setGchatSpaces, gchatSelectedSpaceRef, currentViewRef,
  setGchatMessages, setGchatSpaceTimes, setTrashedGchatSpaces,
  setUnreadGchatSpaces, mutedGchatSpaces,
}) {

  // ─── syncAllNotifications: polls Gmail + GChat every 5s ───────────────────
  useEffect(() => {
    let isFetching = false;
    async function syncAllNotifications() {
      if (isFetching) return;
      isFetching = true;
      try {
        clearSystemError("Notifications");
        const [emailRes, chatRes] = await Promise.all([
          fetch("/.netlify/functions/gmail-inbox?limit=25"),
          fetch("/.netlify/functions/gchat-sync")
        ]);

        const emailData = await emailRes.json();
        const chatData = await chatRes.json();

        let combined = [];

        if (emailData && emailData.ok && Array.isArray(emailData.emails)) {
          if (currentViewRef.current.app === "gmail" && activeFolderRef.current === "INBOX" && !activeSearchRef.current && gmailPageRef.current === 1) {
            setGmailEmails(prev => {
              const existingIds = new Set(prev.map(e => e.id));
              const newEmails = emailData.emails.filter(e => !existingIds.has(e.id));
              if (newEmails.length === 0) return prev;
              return [...newEmails, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date));
            });
          }

          const gmailNotifs = emailData.emails
            .filter(email => email.isUnread)
            .map(email => {
              const cleanFrom = email.from ? email.from.split("<")[0].replace(/"/g, '').trim() : "Someone";
              const isBrandNew = new Date(email.date) > sessionStartTime.current;
              const alreadySounded = soundedGmailIdsRef.current.has(email.id);
              return {
                id: email.id,
                alt: "Gmail",
                icon: gmailIcon,
                text: `${cleanFrom}: ${email.subject || "(No Subject)"}`,
                timestamp: email.date || new Date().toISOString(),
                gmailData: email,
                isSilent: !isBrandNew || alreadySounded
              };
            });
          combined = [...combined, ...gmailNotifs];
        }

        if (chatData && chatData.ok) {
          if (currentViewRef.current.app === "gchat" && Array.isArray(chatData.spaces)) {
            setGchatSpaces(prev => {
              const newSpaces = chatData.spaces.map(s => {
                const sid = s.id || s.name;
                const existing = prev.find(p => (p.id || p.name) === sid);
                return existing ? { ...existing, ...s } : s;
              });
              return newSpaces.sort((a, b) => {
                const timeA = new Date(a.lastActiveTime || a.createTime).getTime();
                const timeB = new Date(b.lastActiveTime || b.createTime).getTime();
                return timeB - timeA;
              });
            });
          }

          const chatNotifs = [];
          const isFirstRun = seenGchatIdsRef.current === null;
          if (isFirstRun) seenGchatIdsRef.current = new Set();

          if (Array.isArray(chatData.notifications)) {
            chatData.notifications.forEach(n => {
              const sid = n.spaceId;
              const ts = n.timestamp;
              const msgId = n.id || n.name;
              const isCurrentlyViewing = gchatSelectedSpaceRef.current?.id === sid || gchatSelectedSpaceRef.current?.name === sid;
              const hasBeenSeen = seenGchatIdsRef.current.has(msgId);

              if (!hasBeenSeen) {
                seenGchatIdsRef.current.add(msgId);

                setTrashedGchatSpaces(prev => {
                  if (prev.includes(sid)) {
                    const next = prev.filter(id => id !== sid);
                    localStorage.setItem("GCHAT_TRASHED", JSON.stringify(next));
                    return next;
                  }
                  return prev;
                });

                setGchatSpaces(prev => {
                  const exists = prev.some(sp => (sp.id || sp.name) === sid);
                  const base = exists ? prev : [...prev, {
                    id: sid, name: sid,
                    displayName: n.senderName || n.title || "Direct Message",
                    type: n.spaceType || "DIRECT_MESSAGE",
                    lastActiveTime: ts, createTime: ts
                  }];
                  return base.map(sp =>
                    (sp.id || sp.name) === sid ? { ...sp, lastActiveTime: ts } : sp
                  ).sort((a, b) =>
                    new Date(b.lastActiveTime || b.createTime) - new Date(a.lastActiveTime || a.createTime)
                  );
                });

                if (!isCurrentlyViewing) {
                  setUnreadGchatSpaces(prev => {
                    const next = { ...prev, [sid]: ts };
                    localStorage.setItem("GCHAT_UNREAD_SPACES", JSON.stringify(next));
                    return next;
                  });

                  setGchatSpaceTimes(prev => {
                    const next = { ...prev, [sid]: ts };
                    localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify(next));
                    return next;
                  });

                  if (!dismissedNotifsRef.current.has(msgId)) {
                    const isAlreadyInUI = notifications.some(existing => existing.id === msgId);
                    if (!isAlreadyInUI) {
                      const lastSenderId = n.sender?.name || "";
                      const spaceObj = gchatSpaces.find(sp => (sp.id || sp.name) === sid);
                      const isDM = n.spaceType === "DIRECT_MESSAGE" || spaceObj?.type === "DIRECT_MESSAGE";
                      let resolvedSender = GCHAT_ID_MAP[lastSenderId] || n.senderName || "Colleague";
                      if (isDM && resolvedSender === "Colleague" && spaceObj?.displayName) {
                        resolvedSender = spaceObj.displayName;
                      }
                      const resolvedSpaceTitle = isDM
                        ? null
                        : (GCHAT_ID_MAP[sid] || spaceObj?.displayName || n.title || "Chat");
                      const notifText = isDM
                        ? (resolvedSender !== "Colleague" ? `${resolvedSender}: ${n.text}` : n.text)
                        : (resolvedSpaceTitle !== "Colleague"
                            ? `${resolvedSpaceTitle} - ${resolvedSender}: ${n.text}`
                            : n.text);

                      const isBrandNewChat = new Date(ts) > sessionStartTime.current;
                      chatNotifs.push({
                        ...n, id: msgId, alt: "Google Chat", icon: gchatIcon,
                        text: notifText, timestamp: ts, spaceId: sid,
                        isSilent: (!isBrandNewChat) || (mutedGchatSpaces.includes(sid) && !n.isMentioned),
                      });
                    }
                  }
                } else {
                  setGchatMessages(prev => {
                    if (prev.some(m => (m.name || m.id) === msgId)) return prev;
                    const incomingMsg = {
                      name: msgId,
                      text: n.text,
                      createTime: ts,
                      sender: { name: n.sender?.name, displayName: n.senderName }
                    };
                    return [...prev, incomingMsg].sort((a, b) => new Date(a.createTime) - new Date(b.createTime));
                  });

                  setGchatSpaceTimes(prev => {
                    const next = { ...prev, [sid]: ts };
                    localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify(next));
                    return next;
                  });

                  setUnreadGchatSpaces(prev => {
                    const next = { ...prev };
                    delete next[sid];
                    return next;
                  });
                }
              }
            });
          }

          combined = [...combined, ...chatNotifs];
          if (isFirstRun) isInitialGchatSyncRef.current = false;
        }

        if (!isMuted && combined.length > 0) {
          const hasNewEmail = combined.some(item => item.alt === "Gmail" && !item.isSilent);
          const hasNewChatAction = combined.some(item => item.alt === "Google Chat" && !item.isSilent);
          if (hasNewEmail) {
            new Audio(GMAIL_SOUND_DATA).play().catch(() => {});
            combined.filter(i => i.alt === "Gmail" && !i.isSilent).forEach(i => soundedGmailIdsRef.current.add(i.id));
          }
          if (hasNewChatAction) {
            new Audio(GCHAT_SOUND_DATA).play().catch(() => {});
          }
        }

        if (combined.length > 0) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const seenInBatch = new Set();
            const newItems = combined.filter(item => {
              if (existingIds.has(item.id) || dismissedNotifsRef.current.has(item.id) || seenInBatch.has(item.id)) return false;
              seenInBatch.add(item.id);
              return true;
            });
            if (newItems.length === 0) return prev;
            const mappedNew = newItems.map(item => ({ ...item, time: formatNotificationDate(item.timestamp) }));
            const next = [...mappedNew, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return next.slice(0, 100);
          });
        }

      } catch (err) {
        console.error("Sync error:", err);
        reportSystemError("Notifications", err.message);
      } finally {
        isFetching = false;
        setNotifLoading(false);
      }
    }

    syncAllNotifications();
    const interval = setInterval(syncAllNotifications, 5000);
    return () => clearInterval(interval);
  }, [isMuted]);

  // ─── pollGmailBackground: polls Gmail inbox every 15s ─────────────────────
  useEffect(() => {
    let isGmailFetching = false;
    const pollGmailBackground = async () => {
      if (isGmailFetching) return;
      isGmailFetching = true;
      try {
        clearSystemError("Gmail Sync");
        const res = await fetch("/.netlify/functions/gmail-inbox?limit=50");
        const json = await res.json().catch(() => ({}));
        if (!json.ok || !Array.isArray(json.emails)) return;

        const isFirstRun = seenGmailIdsRef.current === null;
        if (isFirstRun) seenGmailIdsRef.current = new Set();

        [...json.emails].reverse().forEach(email => {
          const isDismissed = dismissedNotifsRef.current.has(email.id);
          if (email.isUnread && !isDismissed) {
            setNotifications(prev => {
              if (prev.find(p => p.id === email.id)) return prev;
              const isBrandNew = new Date(email.date) > sessionStartTime.current;
              const mapped = {
                id: email.id,
                alt: "Gmail",
                icon: gmailIcon,
                text: `${email.from.split("<")[0].replace(/"/g, '').trim()}: ${email.subject}`,
                timestamp: email.date,
                gmailData: email,
                time: formatNotificationDate(email.date),
                isSilent: (!isBrandNew) || seenGmailIdsRef.current.has(email.id)
              };
              return [mapped, ...prev].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            });
          }
        });

        if (isFirstRun) isInitialGmailSyncRef.current = false;

      } catch (err) {
        console.error("Background Gmail poll failed", err);
        reportSystemError("Gmail Sync", err.message);
      } finally {
        isGmailFetching = false;
      }
    };

    pollGmailBackground();
    const id = setInterval(pollGmailBackground, 15000);
    return () => clearInterval(id);
  }, [isMuted]);
}
