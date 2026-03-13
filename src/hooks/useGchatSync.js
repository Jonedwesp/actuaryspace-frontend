import React, { useState, useRef, useEffect } from "react";
import { useDebounce } from "./useDebounce.js";
import { GCHAT_ID_MAP, normalizeGChatMessage, dedupeMergeMessages } from "../utils/gchatUtils.js";
import gchatIcon from "../assets/Google Chat.png";

export function useGchatSync({
  currentView, setCurrentView,
  triggerSnackbar,
  setNotifications,
  reportSystemError, clearSystemError,
  inputValue, setInputValue,
}) {
  const [pendingUpload, setPendingUpload] = useState(null);

  const [showPlusMenu, setShowPlusMenu] = useState(false);

  /* Google Chat */
  const gchatBodyRef = useRef(null);
  const chatBarRef = useRef(null);
  const [chatBarHeight, setChatBarHeight] = useState(60);
  const pendingScrollAnchorRef = useRef(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPopupPos, setNewChatPopupPos] = useState({ top: 0, left: 0 });
  const newChatBtnRef = useRef(null);
  const [newChatTarget, setNewChatTarget] = useState("");
  const newChatEmailRef = useRef(null);

  const lastActiveSpaceRef = useRef(null);

  const [gchatSpaces, setGchatSpaces] = useState(() => {
    try { return JSON.parse(localStorage.getItem("GCHAT_SPACES_CACHE") || "[]"); }
    catch { return []; }
  });
  const [gchatLoading, setGchatLoading] = useState(false);
  const [gchatError, setGchatError] = useState("");
  const [gchatSelectedSpace, setGchatSelectedSpace] = useState(null);
  const [archivedGchatSpaces, setArchivedGchatSpaces] = useState(() => {
    try { return JSON.parse(localStorage.getItem("GCHAT_ARCHIVED") || "[]"); }
    catch { return []; }
  });
  const [trashedGchatSpaces, setTrashedGchatSpaces] = useState(() => {
    try { return JSON.parse(localStorage.getItem("GCHAT_TRASHED") || "[]"); }
    catch { return []; }
  });
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);

  const [mutedGchatSpaces, setMutedGchatSpaces] = useState(() => {
    try { return JSON.parse(localStorage.getItem("GCHAT_MUTED") || "[]"); }
    catch { return []; }
  });

  useEffect(() => { localStorage.setItem("GCHAT_ARCHIVED", JSON.stringify(archivedGchatSpaces)); }, [archivedGchatSpaces]);
  useEffect(() => { localStorage.setItem("GCHAT_TRASHED", JSON.stringify(trashedGchatSpaces)); }, [trashedGchatSpaces]);
  useEffect(() => { localStorage.setItem("GCHAT_MUTED", JSON.stringify(mutedGchatSpaces)); }, [mutedGchatSpaces]);

  const [unreadGchatSpaces, setUnreadGchatSpaces] = useState(() => {
    try { return JSON.parse(localStorage.getItem("GCHAT_UNREAD_SPACES") || "{}"); }
    catch { return {}; }
  });
  useEffect(() => { localStorage.setItem("GCHAT_UNREAD_SPACES", JSON.stringify(unreadGchatSpaces)); }, [unreadGchatSpaces]);

  const [gchatSpaceTimes, setGchatSpaceTimes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("GCHAT_SPACE_TIMES") || "{}"); }
    catch { return {}; }
  });
  useEffect(() => { localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify(gchatSpaceTimes)); }, [gchatSpaceTimes]);

  const [gchatMessages, setGchatMessages] = useState([]);
  const [gchatNextPageToken, setGchatNextPageToken] = useState(null);
  const [gchatLoadingOlder, setGchatLoadingOlder] = useState(false);
  const [gchatMe, setGchatMe] = useState(null);
  const [gchatMsgLoading, setGchatMsgLoading] = useState(false);
  const [gchatMsgError, setGchatMsgError] = useState("");
  const [gchatComposer, setGchatComposer] = useState("");
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [msgToDelete, setMsgToDelete] = useState(null);
  const [gchatDmNames, setGchatDmNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem("GCHAT_DM_NAMES") || "{}"); }
    catch { return {}; }
  });
  const [gchatAutoScroll, setGchatAutoScroll] = useState(true);
  const isProgrammaticScrollRef = useRef(false);
  const messagesEndRef = useRef(null);
  const pendingInitialScrollSpaceRef = useRef(null);
  const [gchatSearchQuery, setGchatSearchQuery] = useState("");
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [chatSearchText, setChatSearchText] = useState("");
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [spacesExpanded, setSpacesExpanded] = useState(true);

  const debouncedChatSearchText = useDebounce(chatSearchText, 300);
  const debouncedGchatSearchQuery = useDebounce(gchatSearchQuery, 300);

  // Refs block
  const currentViewRef = useRef(currentView);
  const gchatMeRef = useRef(gchatMe);
  const gchatSelectedSpaceRef = useRef(gchatSelectedSpace);
  const gchatDmNamesRef = useRef(gchatDmNames);

  // Sync refs
  useEffect(() => {
    currentViewRef.current = currentView;
    gchatMeRef.current = gchatMe;
    gchatSelectedSpaceRef.current = gchatSelectedSpace;
    gchatDmNamesRef.current = gchatDmNames;
  }, [currentView, gchatMe, gchatSelectedSpace, gchatDmNames]);

  const lastNotifiedRef = useRef({ time: Date.now() });
  const pendingReactionsRef = useRef(new Map());
  const newlyCreatedSpaceIdRef = useRef(null);
  const myReactionsRef = useRef((() => { try { return JSON.parse(localStorage.getItem("GCHAT_MY_REACTIONS") || "{}"); } catch { return {}; } })());
  const myDeletionsRef = useRef((() => { try { return JSON.parse(localStorage.getItem("GCHAT_MY_DELETIONS") || "[]"); } catch { return []; } })());
  const myEditsRef = useRef((() => { try { return JSON.parse(localStorage.getItem("GCHAT_MY_EDITS") || "{}"); } catch { return {}; } })());

  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [reactions, setReactions] = useState(() => { try { return JSON.parse(localStorage.getItem("GCHAT_MY_REACTIONS") || "{}"); } catch { return {}; } });
  const [reactionCounts, setReactionCounts] = useState({});
  const [gchatFilePreview, setGchatFilePreview] = useState(null);

  // Error reporters
  useEffect(() => { gchatError ? reportSystemError("Google Chat", gchatError) : clearSystemError("Google Chat"); }, [gchatError]);
  useEffect(() => { gchatMsgError ? reportSystemError("Chat Messages", gchatMsgError) : clearSystemError("Chat Messages"); }, [gchatMsgError]);

  function toggleReaction(messageId, type) {
    pendingReactionsRef.current.set(messageId, Date.now() + 15000);
    setReactions((prev) => {
      const currentList = prev[messageId] || [];
      const isSame = currentList.includes(type);
      const nextList = isSame ? currentList.filter(t => t !== type) : [...currentList, type];
      myReactionsRef.current[messageId] = nextList;
      try { localStorage.setItem("GCHAT_MY_REACTIONS", JSON.stringify(myReactionsRef.current)); } catch (e) {}
      return { ...prev, [messageId]: nextList };
    });
    fetch("/.netlify/functions/gchat-react", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, type })
    }).catch(err => console.error("Reaction failed", err));
  }

  // Load gchatMe from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("GCHAT_ME");
    if (saved) setGchatMe(saved);
  }, []);

  // Persist last active space
  useEffect(() => {
    if (gchatSelectedSpace) {
      lastActiveSpaceRef.current = gchatSelectedSpace;
      localStorage.setItem("LAST_ACTIVE_SPACE_ID", gchatSelectedSpace.id);
    }
  }, [gchatSelectedSpace]);

  // Close plusMenu on outside click
  useEffect(() => {
    const close = (e) => {
      if (e.target.closest?.(".chat-plus-wrap")) return;
      setShowPlusMenu(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // On space switch: mark that we need an initial scroll to the bottom
  React.useLayoutEffect(() => {
    if (gchatSelectedSpace?.id) {
      pendingInitialScrollSpaceRef.current = gchatSelectedSpace.id;
      setGchatAutoScroll(true);
      setShowJumpToBottom(false);
    }
  }, [gchatSelectedSpace?.id]);

  // Track chat bar height
  React.useEffect(() => {
    const el = chatBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setChatBarHeight(entry.contentRect.height + 48);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll to bottom after messages commit to DOM
  React.useLayoutEffect(() => {
    const el = gchatBodyRef.current;
    if (!el || gchatMessages.length === 0) return;
    if (pendingScrollAnchorRef.current !== null) {
      el.scrollTop += el.scrollHeight - pendingScrollAnchorRef.current;
      pendingScrollAnchorRef.current = null;
      return;
    }
    if (pendingInitialScrollSpaceRef.current === gchatSelectedSpace?.id) {
      pendingInitialScrollSpaceRef.current = null;
      isProgrammaticScrollRef.current = true;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (gchatAutoScroll) {
      isProgrammaticScrollRef.current = true;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = el.scrollHeight;
    }
  }, [gchatMessages, gchatSelectedSpace?.id, gchatAutoScroll]);

  // Global identity loader
  useEffect(() => {
    async function fetchWhoAmI() {
      const stored = localStorage.getItem("GCHAT_ME");
      if (stored) setGchatMe(stored);
      try {
        const res = await fetch("/.netlify/functions/gchat-whoami", { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) console.log("User is not authenticated yet.");
          return;
        }
        const json = await res.json().catch(() => ({}));
        const myId = json.name || json.user?.name || json.resourceName;
        if (myId) {
          console.log("identified current user as:", myId);
          setGchatMe(myId);
          localStorage.setItem("GCHAT_ME", myId);
        }
      } catch (err) {
        console.warn("Silent Auth Check:", err.message);
      }
    }
    fetchWhoAmI();
  }, []);

  // Space loader
  useEffect(() => {
    if (currentView.app !== "gchat") return;
    let cancelled = false;
    async function loadSpaces() {
      try {
        setGchatLoading(true);
        setGchatError("");
        const res = await fetch("/.netlify/functions/gchat-spaces", { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.ok !== true) {
          throw new Error(json?.error || `Failed to load spaces (HTTP ${res.status})`);
        }
        if (!cancelled) {
          const loadedSpaces = Array.isArray(json.spaces) ? json.spaces : [];
          const newLearnedNames = { ...gchatDmNames };
          const newTimes = { ...gchatSpaceTimes };
          let hasNewData = false;
          loadedSpaces.forEach(s => {
            const sid = s.id || s.name;
            if (s.type === "DIRECT_MESSAGE") {
              const currentName = s.displayName;
              if (GCHAT_ID_MAP[sid] || GCHAT_ID_MAP[currentName]) {
                newLearnedNames[sid] = GCHAT_ID_MAP[sid] || GCHAT_ID_MAP[currentName];
                hasNewData = true;
              }
            }
            const apiActiveTime = s.lastActiveTime || s.createTime;
            const apiTs = apiActiveTime ? new Date(apiActiveTime).getTime() : 0;
            const localReadTimeStr = gchatSpaceTimes[sid] || localStorage.getItem(`READ_TIME_${sid}`);
            const localTs = localReadTimeStr ? new Date(localReadTimeStr).getTime() : 0;
            if (apiTs > (localTs + 2000)) {
              newTimes[sid] = apiActiveTime;
              hasNewData = true;
            } else {
              newTimes[sid] = localReadTimeStr;
            }
          });
          if (hasNewData) {
            setGchatDmNames(newLearnedNames);
            setGchatSpaceTimes(newTimes);
            localStorage.setItem("GCHAT_DM_NAMES", JSON.stringify(newLearnedNames));
            localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify(newTimes));
          }
          const readSpaceIds = new Set(
            loadedSpaces
              .filter(s => s.serverLastReadTime && s.lastActiveTime &&
                new Date(s.serverLastReadTime) >= new Date(s.lastActiveTime))
              .map(s => s.id || s.name)
          );
          if (readSpaceIds.size > 0) {
            setNotifications(prev => prev.filter(n =>
              !(n.alt === "Google Chat" && readSpaceIds.has(n.spaceId))
            ));
          }
          setGchatSpaces(loadedSpaces);
          localStorage.setItem("GCHAT_SPACES_CACHE", JSON.stringify(loadedSpaces));

          const activeIds = new Set(loadedSpaces.map(s => s.id || s.name));
          setUnreadGchatSpaces(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => { if (!activeIds.has(id)) delete next[id]; });
            localStorage.setItem("GCHAT_UNREAD_SPACES", JSON.stringify(next));
            return next;
          });
          if (gchatSelectedSpace && !activeIds.has(gchatSelectedSpace.id)) {
            setGchatSelectedSpace(null);
            setGchatMessages([]);
            triggerSnackbar("This chat was deleted in Google Chat.");
          }
          setGchatMsgError("");
          setGchatComposer("");
        }
      } catch (err) {
        if (!cancelled) setGchatError(String(err?.message || err));
      } finally {
        if (!cancelled) setGchatLoading(false);
      }
    }
    loadSpaces();
    return () => { cancelled = true; };
  }, [currentView.app]);

  // DM chat view loader (resolve unnamed DMs)
  useEffect(() => {
    if (currentView.app !== "gchat") return;
    if (!gchatSpaces.length) return;
    const dmsToLoad = gchatSpaces.filter(
      (s) => s.type === "DIRECT_MESSAGE" &&
        (!gchatDmNames[s.id] || gchatDmNames[s.id] === "Direct Message")
    );
    if (!dmsToLoad.length) return;
    Promise.all(
      dmsToLoad.map(async (dm) => {
        try {
          const res = await fetch(`/.netlify/functions/gchat-dm-name?space=${encodeURIComponent(dm.id)}`);
          if (!res.ok) return;
          const json = await res.json().catch(() => ({}));
          if (json.ok && json.names) {
            const label = Object.values(json.names)[0];
            if (label && label !== "Direct Message") {
              setGchatDmNames((prev) => {
                const next = { ...prev, [dm.id]: label };
                localStorage.setItem("GCHAT_DM_NAMES", JSON.stringify(next));
                return next;
              });
            }
          }
        } catch (err) {
          console.error("DM name resolution failed for", dm.id, err);
        }
      })
    );
  }, [currentView.app, gchatSpaces]);

  // Name learner (fixes sidebar mismatch)
  useEffect(() => {
    if (!gchatSelectedSpace || !gchatMessages.length) return;
    const firstMsg = gchatMessages[0];
    const msgSpaceId = firstMsg?.space?.name || firstMsg?.id?.split('/messages/')[0] || firstMsg?.name?.split('/messages/')[0];
    if (msgSpaceId !== gchatSelectedSpaceRef.current?.id) return;
    if (gchatSelectedSpace.type !== "DIRECT_MESSAGE" && gchatSelectedSpace.spaceType !== "DIRECT_MESSAGE") return;
    const currentListName = gchatDmNames[gchatSelectedSpace.id];
    const otherParticipant = gchatMessages.find(m => {
      const sId = m.sender?.name || "";
      const displayName = (m.sender?.displayName || "").toLowerCase();
      if (!m.sender?.displayName) return false;
      if (gchatMe) return sId !== gchatMe && !displayName.includes("siya");
      return !displayName.includes("siya");
    });
    if (!otherParticipant) return;
    const otherId = otherParticipant.sender?.name || "";
    const otherType = otherParticipant.sender?.type || "HUMAN";
    if (GCHAT_ID_MAP[otherId]) {
      const mapName = GCHAT_ID_MAP[otherId];
      if (currentListName !== mapName) {
        setGchatDmNames(prev => {
          const next = { ...prev, [gchatSelectedSpace.id]: mapName };
          localStorage.setItem("GCHAT_DM_NAMES", JSON.stringify(next));
          return next;
        });
      }
      return;
    }
    let targetName = otherParticipant.sender?.displayName || "Direct Message";
    if (otherId === "users/112422887282158931745") targetName = "Repository";
    else if (otherType === "BOT") targetName = "Google Drive";
    if (targetName && !targetName.includes("users/") && currentListName !== targetName) {
      setGchatDmNames(prev => {
        const next = { ...prev, [gchatSelectedSpace.id]: targetName };
        localStorage.setItem("GCHAT_DM_NAMES", JSON.stringify(next));
        return next;
      });
    }
  }, [gchatSelectedSpace, gchatMessages, gchatMe, gchatDmNames]);

  // Message loader + poller
  useEffect(() => {
    if (currentView.app !== "gchat") return;
    if (!gchatSelectedSpace?.id) return;
    let cancelled = false;
    const cachedMsgsStr = localStorage.getItem(`GCHAT_MSGS_${gchatSelectedSpace.id}`);
    let hasCached = false;
    if (cachedMsgsStr) {
      try {
        const parsed = JSON.parse(cachedMsgsStr);
        if (parsed && parsed.length > 0) { setGchatMessages(parsed); hasCached = true; }
        else setGchatMessages([]);
      } catch (e) { setGchatMessages([]); }
    } else {
      setGchatMessages([]);
    }
    setGchatNextPageToken(null);
    setGchatMsgError("");
    setGchatMsgLoading(!hasCached);

    async function fetchLatestAndMerge() {
      try {
        const res = await fetch(
          `/.netlify/functions/gchat-messages?space=${encodeURIComponent(gchatSelectedSpace.id)}`,
          { credentials: "include" }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.ok !== true) {
          if (res.status === 404 || res.status === 403) {
            setGchatSelectedSpace(null);
            setGchatMessages([]);
            if (typeof triggerSnackbar === 'function') triggerSnackbar("This chat was deleted in Google Chat.");
            return;
          }
          throw new Error(json?.error || `Failed to load messages (HTTP ${res.status})`);
        }
        const incomingRaw = Array.isArray(json.messages) ? json.messages : [];
        const deleteTimeStr = localStorage.getItem(`GCHAT_DELETE_TIME_${gchatSelectedSpace.id}`);
        const deleteTs = deleteTimeStr ? new Date(deleteTimeStr).getTime() : 0;
        const incoming = incomingRaw
          .map((m) => normalizeGChatMessage(m))
          .filter(m => new Date(m.createTime).getTime() > deleteTs)
          .map(m => {
            const msgId = m.name || m.id;
            if (myDeletionsRef.current.includes(msgId)) return { ...m, text: "Message deleted by its author", isDeletedLocally: true };
            if (myEditsRef.current[msgId]) return { ...m, text: myEditsRef.current[msgId], isEditedLocally: true };
            return m;
          });
        if (!cancelled) {
          if (gchatSelectedSpace.id !== gchatSelectedSpaceRef.current?.id) {
            console.log("🛡️ Blocking fetch result for stale space.");
            return;
          }
          setGchatMessages((prev) => {
            if (prev.length > incoming.length && incoming.length > 0) {
              const lastPrev = prev[prev.length - 1];
              const lastIn = incoming[incoming.length - 1];
              if (new Date(lastPrev.createTime) > new Date(lastIn.createTime)) return prev;
            }
            const merged = dedupeMergeMessages(prev, incoming, true);
            if (merged.length > 0) {
              const latestMsg = merged[merged.length - 1];
              if (latestMsg?.createTime) {
                setTimeout(() => {
                  setGchatSpaceTimes(t => {
                    const existingTime = t[gchatSelectedSpace.id] ? new Date(t[gchatSelectedSpace.id]).getTime() : 0;
                    const newTime = new Date(latestMsg.createTime).getTime();
                    if (newTime > existingTime) {
                      const next = { ...t, [gchatSelectedSpace.id]: latestMsg.createTime };
                      localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify(next));
                      return next;
                    }
                    return t;
                  });
                }, 0);
              }
            }
            return merged;
          });
          if (json.nextPageToken && gchatMessages.length === 0) {
            setGchatNextPageToken(json.nextPageToken);
          }
          const countsToUpdate = {};
          setReactions((prev) => {
            const next = { ...prev };
            const now = Date.now();
            incoming.forEach((msg) => {
              const msgId = msg.id || msg.name;
              if (pendingReactionsRef.current.has(msgId)) {
                if (now < pendingReactionsRef.current.get(msgId)) return;
                pendingReactionsRef.current.delete(msgId);
              }
              let parsedReactions = [];
              const parsedCounts = {};
              if (msg.reactions && Array.isArray(msg.reactions)) {
                msg.reactions.forEach(rx => {
                  let type = null, count = 1;
                  if (typeof rx === "string") {
                    type = ["like","heart","laugh"].includes(rx) ? rx : null;
                  } else if (rx && rx.type) {
                    type = ["like","heart","laugh"].includes(rx.type) ? rx.type : null;
                    count = rx.count || 1;
                  } else {
                    const uni = rx.emoji?.unicode || "";
                    const name = (rx.emoji?.name || "").toLowerCase();
                    if (uni.includes("👍") || name.includes("thumb") || name.includes("+1")) type = "like";
                    else if (uni.includes("❤️") || uni.includes("❤") || uni === "💖" || name.includes("heart")) type = "heart";
                    else if (uni.includes("😆") || uni.includes("😂") || uni === "😀" || name.includes("laugh") || name.includes("joy") || name.includes("smile") || name.includes("grin")) type = "laugh";
                  }
                  if (type) { parsedReactions.push(type); parsedCounts[type] = count; }
                });
              }
              countsToUpdate[msgId] = parsedCounts;
              const mySaved = myReactionsRef.current[msgId] || [];
              next[msgId] = [...new Set([...mySaved, ...parsedReactions])];
            });
            return next;
          });
          setReactionCounts(prev => ({ ...prev, ...countsToUpdate }));
        }
      } catch (err) {
        if (!cancelled) setGchatMsgError(String(err?.message || err));
      } finally {
        if (!cancelled) setGchatMsgLoading(false);
      }
    }

    fetchLatestAndMerge();
    const pollId = setInterval(fetchLatestAndMerge, 4000);
    const handleRefresh = () => fetchLatestAndMerge();
    window.addEventListener("refreshChatMessages", handleRefresh);
    return () => {
      cancelled = true;
      clearInterval(pollId);
      window.removeEventListener("refreshChatMessages", handleRefresh);
      setGchatMessages([]);
      setGchatMsgLoading(false);
    };
  }, [currentView.app, gchatSelectedSpace?.id]);

  const triggerGChatNotification = (msg, targetSpaceId) => {
    const msgId = msg.name || msg.id;
    const learnedName = gchatDmNamesRef.current[targetSpaceId];
    const senderId = msg.sender?.name || "";
    let senderName = GCHAT_ID_MAP[senderId] || GCHAT_ID_MAP[msg.sender?.displayName] || msg.sender?.displayName || learnedName || "Colleague";
    if (senderName.startsWith("users/")) senderName = learnedName || "Colleague";
    let rawText = msg.text || "";
    if (!rawText && msg.attachment?.length) {
      rawText = `Sent an attachment: ${msg.attachment[0].contentName || "a file"}`;
    }
    const previewText = rawText.length > 45 ? rawText.substring(0, 42) + "..." : rawText;
    window.dispatchEvent(new CustomEvent("notify", {
      detail: {
        id: msgId,
        text: `${senderName}: ${previewText}`,
        alt: "Google Chat",
        icon: gchatIcon,
        spaceId: targetSpaceId,
        senderName: senderName,
        timestamp: msg.createTime
      }
    }));
  };

  const handleStartChat = async (forcedEmail = null) => {
    const rawEmail = forcedEmail || newChatTarget || newChatEmailRef.current?.value || "";
    const targetEmail = rawEmail.trim();
    if (!targetEmail) { alert("Please enter an email address."); return; }
    if (!targetEmail.includes("@") || !targetEmail.includes(".")) {
      alert("Please enter a full email address (e.g. name@company.co.za).");
      return;
    }
    setGchatLoading(true);
    try {
      const res = await fetch("/.netlify/functions/gchat-find-gm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail })
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.space) {
        const spaceId = json.space.name || json.space.id;
        const newSpace = { ...json.space, id: spaceId, type: json.space.spaceType || "DIRECT_MESSAGE" };
        const masterName = GCHAT_ID_MAP[targetEmail] || GCHAT_ID_MAP[json.space.singleUserBotDm ? "" : ""];
        const resolvedName = json.displayName || masterName || targetEmail;
        setGchatDmNames(prev => {
          const next = { ...prev, [spaceId]: resolvedName };
          localStorage.setItem("GCHAT_DM_NAMES", JSON.stringify(next));
          return next;
        });
        const alreadyExists = gchatSpaces.find(s => (s.id === spaceId || s.name === spaceId));
        if (!alreadyExists) newlyCreatedSpaceIdRef.current = spaceId;
        setTrashedGchatSpaces(prev => {
          if (!prev.includes(spaceId)) return prev;
          const next = prev.filter(id => id !== spaceId);
          localStorage.setItem("GCHAT_TRASHED", JSON.stringify(next));
          return next;
        });
        setGchatSpaces(prev => {
          const exists = prev.find(s => (s.id === spaceId || s.name === spaceId));
          if (exists) return prev.map(s => (s.id === spaceId || s.name === spaceId) ? { ...s, displayName: resolvedName } : s);
          return [{ ...newSpace, displayName: resolvedName, _provisional: true }, ...prev];
        });
        setCurrentView({ app: "gchat", contact: null });
        setGchatSelectedSpace({ ...newSpace, displayName: resolvedName });
        if (newChatEmailRef.current) newChatEmailRef.current.value = "";
        setNewChatTarget("");
        setShowNewChatModal(false);
        lastActiveSpaceRef.current = newSpace;
        localStorage.setItem("LAST_ACTIVE_SPACE_ID", spaceId);
      } else {
        alert(json.error || "User not found. Ensure the email is correct.");
      }
    } catch (err) {
      console.error("Initiate chat failed:", err);
      alert("System Error: Could not connect to the chat initiator.");
    } finally {
      setGchatLoading(false);
    }
  };

  const handleDeleteGChatMessage = (messageId) => {
    setMsgToDelete(messageId);
  };

  const confirmDeleteGChatMessage = async () => {
    if (!msgToDelete) return;
    const messageId = msgToDelete;
    setMsgToDelete(null);
    window.dispatchEvent(new Event("pauseTrelloPolling"));
    myDeletionsRef.current = [...new Set([...myDeletionsRef.current, messageId])];
    try { localStorage.setItem("GCHAT_MY_DELETIONS", JSON.stringify(myDeletionsRef.current)); } catch (e) {}
    try {
      setGchatMessages(prev => prev.map(m => (m.name || m.id) === messageId ? { ...m, text: "Message deleted by its author", isDeletedLocally: true } : m));
      const res = await fetch("/.netlify/functions/gchat-delete-message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId })
      });
      if (res.ok) triggerSnackbar("Message deleted");
    } catch (err) {
      console.error("Delete failed", err);
      triggerSnackbar("Failed to delete message on server");
    }
  };

const confirmDeleteChat = (spaceOverride = null) => {
    const target = spaceOverride || chatToDelete;
    if (!target) return;
    const sid = target.id || target.name;
    const isDM = target.type === "DIRECT_MESSAGE" || target.spaceType === "DIRECT_MESSAGE" || sid.startsWith("users/");
    
    window.dispatchEvent(new Event("pauseTrelloPolling"));
    localStorage.setItem(`GCHAT_DELETE_TIME_${sid}`, new Date().toISOString());
    localStorage.removeItem(`GCHAT_MSGS_${sid}`);
    
    setTrashedGchatSpaces(prev => {
      const next = [...new Set([...prev, sid])];
      localStorage.setItem("GCHAT_TRASHED", JSON.stringify(next));
      return next;
    });

    // ZERO-LATENCY UI: Strip it from the primary spaces array immediately
    setGchatSpaces(prev => prev.filter(s => (s.id || s.name) !== sid));

    if (gchatSelectedSpace?.id === sid || gchatSelectedSpace?.name === sid) {
      setGchatSelectedSpace(null);
      setGchatMessages([]);
    }
    
    const snackbarMsg = isDM ? "Conversation hidden and history cleared" : "Space deleted permanently";
    if (!spaceOverride) setChatToDelete(null);
    triggerSnackbar(snackbarMsg);
    
    // Fire and forget the backend fetch without awaiting it
    const endpoint = isDM ? "/.netlify/functions/gchat-hide-chat" : "/.netlify/functions/gchat-delete-space";
    fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId: sid })
    }).catch(err => console.error("Failed to sync chat status with Google", err));
  };

  const handleUpdateGChatMessage = async (messageId, newText) => {
    if (!newText.trim()) return;
    myEditsRef.current[messageId] = newText.trim();
    try { localStorage.setItem("GCHAT_MY_EDITS", JSON.stringify(myEditsRef.current)); } catch (e) {}
    try {
      setGchatMessages(prev => prev.map(m => (m.name || m.id) === messageId ? { ...m, text: newText, isEditedLocally: true } : m));
      setEditingMsgId(null);
      await fetch("/.netlify/functions/gchat-update-message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, text: newText })
      });
    } catch (err) { console.error("Update failed", err); }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    const currentUpload = pendingUpload;
    if (!text && !currentUpload) return;
    setInputValue("");
    setPendingUpload(null);
    const ta = document.querySelector(".chat-textarea");
    if (ta) {
      ta.style.height = "auto";
      ta.style.overflowY = "hidden";
      ta.closest(".chat-bar")?.classList.remove("expanded");
    }
    if (currentView.app === "gchat" && gchatSelectedSpace) {
      try {
        let json = {};
        if (currentUpload) {
          const reader = new FileReader();
          reader.readAsDataURL(currentUpload.file);
          await new Promise((resolve, reject) => {
            reader.onload = async () => {
              try {
                const base64Content = reader.result.split(",")[1];
                const res = await fetch("/.netlify/functions/gchat-upload", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    space: gchatSelectedSpace.id,
                    text: text,
                    filename: currentUpload.file.name,
                    mimeType: currentUpload.file.type,
                    fileBase64: base64Content
                  }),
                });
                json = await res.json().catch(() => ({}));
                if (!res.ok || !json.ok) {
                  console.error("Upload failed:", json);
                  alert(`Upload failed: ${json.error || "Unknown error"}`);
                  reject();
                  return;
                }
                window.dispatchEvent(new Event("refreshChatMessages"));
                resolve();
              } catch (e) {
                console.error("Reader/Fetch error:", e);
                reject();
              }
            };
          });
        } else {
          const res = await fetch("/.netlify/functions/gchat-send", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ space: gchatSelectedSpace.id, text }),
          });
          json = await res.json().catch(() => ({}));
        }
        if (json.ok && json.message) {
          setGchatSpaces(prev => prev.map(sp =>
            (sp.id || sp.name) === (gchatSelectedSpace?.id || gchatSelectedSpace?.name) ? { ...sp, _provisional: false } : sp
          ));
          const me = json.message?.sender?.name;
          if (me && !gchatMe) {
            setGchatMe(me);
            localStorage.setItem("GCHAT_ME", me);
          }
          if (json.message.sender) {
            const activePersona = (import.meta.env.VITE_PERSONA || "SIYA").toUpperCase();
            json.message.sender.displayName = activePersona === "YOLANDIE" ? "Yolandie" : "Siyabonga Nono";
          }
          const spaceId = gchatSelectedSpace.id;
          const futureBuffer = new Date(Date.now() + 10000).toISOString();
          setGchatSpaceTimes(prev => {
            const next = { ...prev, [spaceId]: futureBuffer };
            localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify(next));
            return next;
          });
          setUnreadGchatSpaces(prev => {
            const next = { ...prev };
            delete next[spaceId];
            delete next[gchatSelectedSpace.name];
            return next;
          });
          setUnreadGchatSpaces(prev => {
            const next = { ...prev };
            delete next[spaceId];
            return next;
          });
          setGchatMessages((prev) => dedupeMergeMessages(prev, [json.message]));
          setInputValue("");
        }
} catch (err) {
        console.error("gchat-send/upload failed:", err);
        alert("Message failed to send. Check console.");
      }
      const ta2 = document.querySelector(".chat-textarea");
      if (ta2) {
        ta2.style.height = "auto";
        ta2.style.overflowY = "hidden";
        ta2.closest(".chat-bar")?.classList.remove("expanded");
      }
    }
  };

  const handleArchiveChat = (spaceId) => {
    if (!spaceId) return;
    
    // 1. Zero-latency Optimistic UI update
    setArchivedGchatSpaces(prev => {
      const next = [...new Set([...prev, spaceId])];
      localStorage.setItem("GCHAT_ARCHIVED", JSON.stringify(next));
      return next;
    });

    if (gchatSelectedSpace?.id === spaceId || gchatSelectedSpace?.name === spaceId) {
      setGchatSelectedSpace(null);
      setGchatMessages([]);
    }

    if (typeof triggerSnackbar === 'function') triggerSnackbar("Chat archived.");

    // 2. Fire-and-forget backend sync (No awaiting)
    fetch("/.netlify/functions/gchat-archive-space", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId })
    }).catch(err => console.error("Failed to sync archive status", err));
  };

  const handleUnarchiveChat = (spaceId) => {
    if (!spaceId) return;
    
    // 1. Zero-latency Optimistic UI update
    setArchivedGchatSpaces(prev => {
      const next = prev.filter(id => id !== spaceId);
      localStorage.setItem("GCHAT_ARCHIVED", JSON.stringify(next));
      return next;
    });

    if (typeof triggerSnackbar === 'function') triggerSnackbar("Chat unarchived.");

    // 2. Fire-and-forget backend sync (No awaiting)
    fetch("/.netlify/functions/gchat-unarchive-space", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId })
    }).catch(err => console.error("Failed to sync unarchive status", err));
  };

  return {
    showPlusMenu, setShowPlusMenu,
    gchatBodyRef,
    chatBarRef,
    chatBarHeight, setChatBarHeight,
    pendingScrollAnchorRef,
    showNewChatModal, setShowNewChatModal,
    newChatPopupPos, setNewChatPopupPos,
    newChatBtnRef,
    newChatTarget, setNewChatTarget,
    newChatEmailRef,
    lastActiveSpaceRef,
    gchatSpaces, setGchatSpaces,
    gchatLoading, setGchatLoading,
    gchatError, setGchatError,
    gchatSelectedSpace, setGchatSelectedSpace,
    archivedGchatSpaces, setArchivedGchatSpaces,
    trashedGchatSpaces, setTrashedGchatSpaces,
    showArchivedChats, setShowArchivedChats,
    chatToDelete, setChatToDelete,
    mutedGchatSpaces, setMutedGchatSpaces,
    unreadGchatSpaces, setUnreadGchatSpaces,
    gchatSpaceTimes, setGchatSpaceTimes,
    gchatMessages, setGchatMessages,
    gchatNextPageToken, setGchatNextPageToken,
    gchatLoadingOlder, setGchatLoadingOlder,
    gchatMe, setGchatMe,
    gchatMsgLoading, setGchatMsgLoading,
    gchatMsgError, setGchatMsgError,
    gchatComposer, setGchatComposer,
    editingMsgId, setEditingMsgId,
    editValue, setEditValue,
    msgToDelete, setMsgToDelete,
    gchatDmNames, setGchatDmNames,
    gchatAutoScroll, setGchatAutoScroll,
    isProgrammaticScrollRef,
    messagesEndRef,
    pendingInitialScrollSpaceRef,
    gchatSearchQuery, setGchatSearchQuery,
    isChatSearchOpen, setIsChatSearchOpen,
    chatSearchText, setChatSearchText,
    showJumpToBottom, setShowJumpToBottom,
    dmsExpanded, setDmsExpanded,
    spacesExpanded, setSpacesExpanded,
    debouncedChatSearchText,
    debouncedGchatSearchQuery,
    currentViewRef,
    gchatMeRef,
    gchatSelectedSpaceRef,
    gchatDmNamesRef,
    lastNotifiedRef,
    pendingReactionsRef,
    newlyCreatedSpaceIdRef,
    myReactionsRef,
    myDeletionsRef,
    myEditsRef,
    hoveredMsgId, setHoveredMsgId,
    reactions, setReactions,
    reactionCounts, setReactionCounts,
    gchatFilePreview, setGchatFilePreview,
    toggleReaction,
    triggerGChatNotification,
handleStartChat,
    handleDeleteGChatMessage,
    confirmDeleteGChatMessage,
    confirmDeleteChat,
    handleArchiveChat,
    handleUnarchiveChat,
    handleUpdateGChatMessage,
    handleSend,
    pendingUpload, setPendingUpload,
  };
}