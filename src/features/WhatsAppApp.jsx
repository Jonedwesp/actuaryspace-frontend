import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRecording } from "../hooks/useRecording.js";
import whatsappIcon from "../assets/WhatsApp.png";

const FAKE_REPLIES = [
  "Got it, thanks!",
  "Sure, I'll take a look.",
  "Noted, will revert shortly.",
  "Sounds good to me.",
  "Thanks for the update!",
  "Let me check and come back to you.",
  "Perfect, appreciated.",
  "👍",
  "Will do!",
  "On it.",
  "Makes sense, thanks Siya.",
  "I'll follow up with you later.",
];

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

const DUMMY_CHATS = [
  {
    id: "1",
    name: "Bonolo Mokatse",
    initials: "BM",
    color: "#6264a7",
    lastMessage: "I'll send the report over by end of day.",
    time: "10:42",
    unread: 2,
    messages: [
      { id: "m1", text: "Hey Siya, do you have the Q3 numbers ready?", mine: false, time: "10:30" },
      { id: "m2", text: "Almost done, just finalising the mortality assumptions.", mine: true, time: "10:32" },
      { id: "m3", text: "No rush, just need it before the 3pm meeting.", mine: false, time: "10:35" },
      { id: "m4", text: "Got it. Will have it to you by 2:30.", mine: true, time: "10:38" },
      { id: "m5", text: "I'll send the report over by end of day.", mine: false, time: "10:42" },
    ],
  },
  {
    id: "2",
    name: "Tiffany Harzon-Cuyler",
    initials: "TH",
    color: "#d83b01",
    lastMessage: "Can we reschedule to Thursday?",
    time: "09:15",
    unread: 0,
    messages: [
      { id: "m1", text: "Hi Siya, I've updated the valuation model with your comments.", mine: false, time: "08:50" },
      { id: "m2", text: "Great, I'll review it now.", mine: true, time: "08:55" },
      { id: "m3", text: "Let me know if you need anything changed.", mine: false, time: "09:00" },
      { id: "m4", text: "Looks good overall. Just fix the discount rate on tab 3.", mine: true, time: "09:10" },
      { id: "m5", text: "Can we reschedule to Thursday?", mine: false, time: "09:15" },
    ],
  },
  {
    id: "3",
    name: "Simoné Streicher",
    initials: "SS",
    color: "#0078d4",
    lastMessage: "Perfect, see you there.",
    time: "Yesterday",
    unread: 1,
    messages: [
      { id: "m1", text: "Siya, are you available for a quick call tomorrow?", mine: false, time: "17:20" },
      { id: "m2", text: "What time were you thinking?", mine: true, time: "17:25" },
      { id: "m3", text: "Around 10am?", mine: false, time: "17:26" },
      { id: "m4", text: "I have a client meeting then, sorry.", mine: true, time: "17:30" },
      { id: "m5", text: "Perfect, see you there.", mine: false, time: "17:31" },
    ],
  },
  {
    id: "4",
    name: "Songeziwe Chiya",
    initials: "SC",
    color: "#005a9e",
    lastMessage: "I'll draft the slide deck tonight.",
    time: "Yesterday",
    unread: 0,
    messages: [
      { id: "m1", text: "Hi Siya, the board presentation is next Friday.", mine: false, time: "11:00" },
      { id: "m2", text: "I know, we need to start pulling the data together.", mine: true, time: "11:05" },
      { id: "m3", text: "Should I handle the embedded value section?", mine: false, time: "11:08" },
      { id: "m4", text: "Yes please, and include the sensitivity analysis.", mine: true, time: "11:12" },
      { id: "m5", text: "I'll draft the slide deck tonight.", mine: false, time: "11:15" },
    ],
  },
  {
    id: "5",
    name: "Enock Kazembe",
    initials: "EK",
    color: "#c239b3",
    lastMessage: "Noted, I'll update the tracker.",
    time: "Mon",
    unread: 0,
    messages: [
      { id: "m1", text: "Siya, the reinsurance treaty renewal is due end of month.", mine: false, time: "14:00" },
      { id: "m2", text: "Thanks for the heads up. Are the terms ready for review?", mine: true, time: "14:10" },
      { id: "m3", text: "Almost — just waiting on the loss ratio data from Bonolo.", mine: false, time: "14:20" },
      { id: "m4", text: "Ok, ping me once you have it.", mine: true, time: "14:22" },
      { id: "m5", text: "Noted, I'll update the tracker.", mine: false, time: "14:25" },
    ],
  },
  {
    id: "6",
    name: "Bonisa Mqonqo",
    initials: "BM",
    color: "#038387",
    lastMessage: "Thanks all, great session!",
    time: "Mon",
    unread: 3,
    messages: [
      { id: "m1", text: "Morning — agenda for today's session is in the shared drive.", mine: true, time: "08:30" },
      { id: "m2", text: "Got it, thanks Siya!", mine: false, time: "08:35" },
      { id: "m3", text: "Can we push the lapse assumption item to item 3?", mine: false, time: "08:40" },
      { id: "m4", text: "Sure, updated the agenda now.", mine: true, time: "08:42" },
      { id: "m5", text: "Thanks all, great session!", mine: false, time: "10:05" },
    ],
  },
  {
    id: "7",
    name: "Albert Grobler",
    initials: "AG",
    color: "#107c10",
    lastMessage: "👍",
    time: "Sun",
    unread: 0,
    messages: [
      { id: "m1", text: "Siya, just checking — did you sign off on the IBNR run?", mine: false, time: "14:00" },
      { id: "m2", text: "Yes, approved this morning.", mine: true, time: "14:10" },
      { id: "m3", text: "👍", mine: false, time: "14:11" },
    ],
  },
  {
    id: "8",
    name: "Tinashe Chikwamba",
    initials: "TC",
    color: "#e3008c",
    lastMessage: "The model is ready for sign-off.",
    time: "Sun",
    unread: 0,
    messages: [
      { id: "m1", text: "Hi Siya, I've finished the expense assumption update.", mine: false, time: "15:00" },
      { id: "m2", text: "Great work. Did you stress-test the inflation scenarios?", mine: true, time: "15:10" },
      { id: "m3", text: "Yes — all three scenarios look reasonable.", mine: false, time: "15:14" },
      { id: "m4", text: "Perfect. I'll review tonight.", mine: true, time: "15:16" },
      { id: "m5", text: "The model is ready for sign-off.", mine: false, time: "15:30" },
    ],
  },
  {
    id: "9",
    name: "Cameron Curtis",
    initials: "CC",
    color: "#8764b8",
    lastMessage: "See you at the ASSA conference.",
    time: "Sat",
    unread: 1,
    messages: [
      { id: "m1", text: "Siya, are you presenting at ASSA this year?", mine: false, time: "13:00" },
      { id: "m2", text: "Yes — on the longevity risk panel.", mine: true, time: "13:05" },
      { id: "m3", text: "Fantastic! What's your slot?", mine: false, time: "13:06" },
      { id: "m4", text: "Thursday 2pm, main hall.", mine: true, time: "13:08" },
      { id: "m5", text: "See you at the ASSA conference.", mine: false, time: "13:10" },
    ],
  },
  {
    id: "10",
    name: "Miné Moolman",
    initials: "MM",
    color: "#986f0b",
    lastMessage: "I'll circulate the minutes now.",
    time: "Fri",
    unread: 0,
    messages: [
      { id: "m1", text: "Hi Siya, do you have notes from the risk committee meeting?", mine: false, time: "16:00" },
      { id: "m2", text: "Yes, I'll send them over shortly.", mine: true, time: "16:05" },
      { id: "m3", text: "Thanks — the CFO is asking for them.", mine: false, time: "16:07" },
      { id: "m4", text: "Sending now.", mine: true, time: "16:09" },
      { id: "m5", text: "I'll circulate the minutes now.", mine: false, time: "16:12" },
    ],
  },
  {
    id: "11",
    name: "Ethan Maburutse",
    initials: "EM",
    color: "#00b7c3",
    lastMessage: "Claim ratios are looking better this quarter.",
    time: "Fri",
    unread: 2,
    messages: [
      { id: "m1", text: "Siya, I've pulled the quarterly claims data.", mine: false, time: "10:00" },
      { id: "m2", text: "Any red flags?", mine: true, time: "10:05" },
      { id: "m3", text: "Large claims are up but frequency is down.", mine: false, time: "10:08" },
      { id: "m4", text: "Ok, let's discuss in the 2pm review.", mine: true, time: "10:10" },
      { id: "m5", text: "Claim ratios are looking better this quarter.", mine: false, time: "10:12" },
    ],
  },
  {
    id: "12",
    name: "Shamiso Hapaguti",
    initials: "SH",
    color: "#bf0077",
    lastMessage: "Will do, thanks Siya!",
    time: "Thu",
    unread: 0,
    messages: [
      { id: "m1", text: "Hi, can you review my pricing memo before EOD?", mine: false, time: "09:00" },
      { id: "m2", text: "Sure, send it over.", mine: true, time: "09:05" },
      { id: "m3", text: "Just sent it to your email.", mine: false, time: "09:06" },
      { id: "m4", text: "Got it. I'll add comments by lunch.", mine: true, time: "09:08" },
      { id: "m5", text: "Will do, thanks Siya!", mine: false, time: "09:10" },
    ],
  },
  {
    id: "13",
    name: "Melokuhle Mabuza",
    initials: "MM",
    color: "#498205",
    lastMessage: "Noted, speak soon.",
    time: "Thu",
    unread: 0,
    messages: [
      { id: "m1", text: "Siya, the policyholder data extract is ready.", mine: false, time: "11:00" },
      { id: "m2", text: "Thanks. Any data quality issues?", mine: true, time: "11:05" },
      { id: "m3", text: "A few nulls in the date-of-birth field, flagged them.", mine: false, time: "11:08" },
      { id: "m4", text: "Ok, let's clean those before the valuation run.", mine: true, time: "11:10" },
      { id: "m5", text: "Noted, speak soon.", mine: false, time: "11:12" },
    ],
  },
];

export function WhatsAppApp({ onChatClick }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatMessages, setChatMessages] = useState(() => {
    const map = {};
    DUMMY_CHATS.forEach((c) => { map[c.id] = c.messages; });
    return map;
  });
  const [pendingUpload, setPendingUpload] = useState(null);
  const [pendingBlobUrl, setPendingBlobUrl] = useState(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [hoveredChatId, setHoveredChatId] = useState(null);

  // Feature state
  const [archivedIds, setArchivedIds] = useState(new Set());
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [manualUnreadIds, setManualUnreadIds] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [showArchivedView, setShowArchivedView] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const plusWrapRef = useRef(null);
  const composeRef = useRef(null);
  const [newChatPos, setNewChatPos] = useState(null);

  // Recording — adapter unwraps { file, kind } → raw File
  const { isRecording, startRecording, stopRecording } = useRecording({
    setPendingUpload: (val) => { setPendingUpload(val?.file ?? val); setPendingBlobUrl(null); },
  });

  // Derived lists
  const visibleChats = DUMMY_CHATS.filter(c => !archivedIds.has(c.id) && !deletedIds.has(c.id));
  const archivedChats = DUMMY_CHATS.filter(c => archivedIds.has(c.id) && !deletedIds.has(c.id));
  const filteredChats = searchQuery.trim()
    ? visibleChats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : visibleChats;
  const filteredArchived = searchQuery.trim()
    ? archivedChats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : archivedChats;
  const newChatContacts = DUMMY_CHATS.filter(c =>
    !deletedIds.has(c.id) &&
    (!newChatSearch.trim() || c.name.toLowerCase().includes(newChatSearch.toLowerCase()))
  );

  const chat = DUMMY_CHATS.find((c) => c.id === selectedChat) || null;
  const messages = selectedChat ? (chatMessages[selectedChat] || []) : [];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChat, messages.length]);

  // Close plus menu on outside click
  useEffect(() => {
    if (!showPlusMenu) return;
    const handler = (e) => {
      if (plusWrapRef.current && !plusWrapRef.current.contains(e.target)) setShowPlusMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlusMenu]);

  // Close row menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const openChat = (id) => {
    onChatClick?.();
    setSelectedChat(id);
    setOpenMenuId(null);
    setShowChatSearch(false);
    setChatSearchQuery("");
    setManualUnreadIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleArchive = (id) => {
    setArchivedIds(prev => new Set([...prev, id]));
    setOpenMenuId(null);
    if (selectedChat === id) setSelectedChat(null);
  };

  const handleUnarchive = (id) => {
    setArchivedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setOpenMenuId(null);
  };

  const handleDeleteConfirm = (id) => {
    setDeletedIds(prev => new Set([...prev, id]));
    setShowDeleteConfirm(null);
    if (selectedChat === id) setSelectedChat(null);
  };

  const handleMarkUnread = (id) => {
    setManualUnreadIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setOpenMenuId(null);
  };

  const handleSend = () => {
    if (!inputValue.trim() && !pendingUpload) return;
    if (!selectedChat) return;
    const now = new Date();
    const time = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
    const newMsg = {
      id: `m${Date.now()}`,
      text: inputValue.trim(),
      mine: true,
      time,
      file: pendingUpload ? {
        name: pendingUpload.name,
        size: pendingUpload.size,
        blobUrl: pendingBlobUrl,
        isImage: !!pendingBlobUrl,
      } : null,
    };
    setChatMessages((prev) => ({ ...prev, [selectedChat]: [...(prev[selectedChat] || []), newMsg] }));
    setInputValue("");
    setPendingUpload(null);
    setPendingBlobUrl(null);
    const ta = document.querySelector(".wa-input");
    if (ta) { ta.style.height = "auto"; }

    // Fake reply after 1.5–3s
    const replyDelay = 1500 + Math.random() * 1500;
    const replyChat = DUMMY_CHATS.find((c) => c.id === selectedChat);
    if (replyChat) {
      setTimeout(() => {
        const replyTime = new Date();
        const replyTimeStr = replyTime.getHours().toString().padStart(2, "0") + ":" + replyTime.getMinutes().toString().padStart(2, "0");
        const replyText = FAKE_REPLIES[Math.floor(Math.random() * FAKE_REPLIES.length)];
        const replyMsg = { id: `m${Date.now()}`, text: replyText, mine: false, time: replyTimeStr };
        setChatMessages((prev) => ({ ...prev, [selectedChat]: [...(prev[selectedChat] || []), replyMsg] }));
        window.dispatchEvent(new CustomEvent("notify", {
          detail: {
            id: `wa-${Date.now()}`,
            alt: "WhatsApp",
            icon: whatsappIcon,
            text: `${replyChat.name}: ${replyText}`,
            timestamp: replyTime.toISOString(),
            isSilent: false,
          }
        }));
      }, replyDelay);
    }
  };

  // Reset match index when query changes
  useEffect(() => { setCurrentMatchIndex(0); }, [chatSearchQuery]);

  // Build global match map: { total, byMsgId: { [id]: { start, count } } }
  const matchInfo = useMemo(() => {
    if (!chatSearchQuery.trim()) return { total: 0, byMsgId: {} };
    const escaped = chatSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let total = 0;
    const byMsgId = {};
    messages.forEach(msg => {
      if (!msg.text) return;
      const found = [...msg.text.matchAll(new RegExp(escaped, "gi"))];
      if (found.length) { byMsgId[msg.id] = { start: total, count: found.length }; total += found.length; }
    });
    return { total, byMsgId };
  }, [chatSearchQuery, messages]);

  // Scroll current match into view
  useEffect(() => {
    if (!chatSearchQuery.trim() || matchInfo.total === 0) return;
    const el = document.querySelector(`[data-match-global="${currentMatchIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentMatchIndex, chatSearchQuery, matchInfo.total]);

  // Highlight search matches in text, tagging each with a global index
  const highlightMsg = (text, query, msgId) => {
    if (!query.trim()) return text;
    const info = matchInfo.byMsgId[msgId];
    if (!info) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    let localIdx = 0;
    return parts.map((p, i) => {
      if (p.toLowerCase() === query.toLowerCase()) {
        const globalIdx = info.start + localIdx++;
        const isCurrent = globalIdx === currentMatchIndex;
        return <mark key={i} data-match-global={globalIdx} style={{ background: isCurrent ? "#f59f00" : "#ffd54f", color: "inherit", borderRadius: "2px", padding: "0 1px" }}>{p}</mark>;
      }
      return p;
    });
  };

  // Helper to render a chat row (reused for main list + archived view)
  const renderChatRow = (c, isArchived = false) => {
    const isUnread = manualUnreadIds.has(c.id) || (!manualUnreadIds.has(c.id) && c.unread > 0 && selectedChat !== c.id);
    const initialUnread = c.unread > 0 && selectedChat !== c.id && !manualUnreadIds.has(c.id);
    const showDot = manualUnreadIds.has(c.id) || initialUnread;
    return (
      <div
        key={c.id}
        className={`wa-chat-row${selectedChat === c.id ? " wa-chat-row--active" : ""}`}
        onClick={() => openChat(c.id)}
        onMouseEnter={() => setHoveredChatId(c.id)}
        onMouseLeave={() => setHoveredChatId(null)}
      >
        <div className="wa-avatar" style={{ background: c.color }}>{c.initials}</div>
        <div className="wa-chat-row-body">
          <div className="wa-chat-row-top">
            <span className="wa-chat-name">{c.name}</span>
            <div className="wa-chat-row-meta" style={{ position: "relative", display: "flex", alignItems: "center", gap: "4px" }}>
              <span className="wa-chat-time">{c.time}</span>
              {(hoveredChatId === c.id || openMenuId === c.id) && (
                <button
                  className="wa-row-menu-btn"
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                  title="More options"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              )}
              {openMenuId === c.id && (
                <div className="wa-row-menu" onClick={(e) => e.stopPropagation()}>
                  {isArchived ? (
                    <button className="wa-row-menu-item" onClick={() => handleUnarchive(c.id)}>Unarchive chat</button>
                  ) : (
                    <button className="wa-row-menu-item" onClick={() => handleArchive(c.id)}>Archive chat</button>
                  )}
                  <button className="wa-row-menu-item wa-row-menu-item--danger" onClick={() => { setShowDeleteConfirm(c.id); setOpenMenuId(null); }}>Delete chat</button>
                  <button className="wa-row-menu-item" onClick={() => handleMarkUnread(c.id)}>
                    {manualUnreadIds.has(c.id) ? "Mark as read" : "Mark as unread"}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="wa-chat-row-bottom">
            <span className="wa-chat-snippet">{c.lastMessage}</span>
            {showDot && <span className="wa-unread-dot" />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="whatsapp-shell">

      {/* ── LEFT SIDEBAR ── */}
      <div className="whatsapp-sidebar">

        {showArchivedView ? (
          /* ── ARCHIVED VIEW ── */
          <>
            <div className="wa-sidebar-header">
              <button className="wa-icon-btn" title="Back" onClick={() => setShowArchivedView(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <span style={{ fontWeight: 600, fontSize: "16px", color: "#111b21" }}>Archived</span>
              <div style={{ width: 28 }} />
            </div>
            <div className="wa-chat-list" onClick={() => setOpenMenuId(null)}>
              {filteredArchived.length === 0 ? (
                <div style={{ padding: "24px 16px", color: "#8696a0", fontSize: "14px", textAlign: "center" }}>No archived chats</div>
              ) : filteredArchived.map(c => renderChatRow(c, true))}
            </div>
          </>
        ) : (
          /* ── MAIN VIEW ── */
          <>
            <div className="wa-sidebar-header">
              <span style={{ fontWeight: 600, fontSize: "18px", color: "#111b21" }}>Chats</span>
              <button ref={composeRef} className="wa-icon-btn" title="New chat" onClick={() => { const r = composeRef.current?.getBoundingClientRect(); if (r) setNewChatPos({ top: r.bottom + 8, centerX: r.left + r.width / 2 }); setShowNewChat(true); setNewChatSearch(""); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="10" y1="14" x2="17" y2="7"/>
                  <polyline points="13 7 17 7 17 11"/>
                </svg>
              </button>
            </div>

            <div className="wa-search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <div className="wa-chat-list" onClick={() => setOpenMenuId(null)}>
              {filteredChats.map(c => renderChatRow(c, false))}

              {/* Archived pill */}
              {archivedChats.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 14px" }}>
                  <button className="wa-archived-btn" onClick={() => setShowArchivedView(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="21 8 21 21 3 21 3 8"/>
                      <rect x="1" y="3" width="22" height="5"/>
                      <line x1="10" y1="12" x2="14" y2="12"/>
                    </svg>
                    Archived ({archivedChats.length})
                  </button>
                </div>
              )}
              {archivedChats.length === 0 && (
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 14px" }}>
                  <button className="wa-archived-btn" onClick={() => setShowArchivedView(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="21 8 21 21 3 21 3 8"/>
                      <rect x="1" y="3" width="22" height="5"/>
                      <line x1="10" y1="12" x2="14" y2="12"/>
                    </svg>
                    Archived
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT THREAD ── */}
      <div className="whatsapp-thread" style={!chat ? { backgroundImage: "none", backgroundColor: "#f0f2f5" } : {}}>
        {chat ? (
          <>
            {/* Top bar */}
            <div className="wa-thread-topbar">
              <div className="wa-avatar" style={{ background: chat.color, width: "38px", height: "38px", fontSize: "14px" }}>
                {chat.initials}
              </div>
              <div style={{ marginLeft: "12px" }}>
                <div style={{ fontWeight: 600, fontSize: "15px", color: "#111b21" }}>{chat.name}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                <button className="wa-icon-btn" title="Voice call">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/>
                  </svg>
                </button>
                <button className="wa-icon-btn" title="Search" onClick={() => { setShowChatSearch(v => !v); setChatSearchQuery(""); }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showChatSearch ? "#25d366" : "#54656f"} strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* In-chat search bar */}
            {showChatSearch && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: "#fff", borderBottom: "1px solid #e9edef" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  autoFocus
                  placeholder="Search in chat"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "14px", color: "#111b21" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  {chatSearchQuery.trim() && (
                    <span style={{ fontSize: "12px", color: "#54656f", whiteSpace: "nowrap" }}>
                      {matchInfo.total === 0 ? "0 of 0" : `${currentMatchIndex + 1} of ${matchInfo.total}`}
                    </span>
                  )}
                  <button
                    disabled={matchInfo.total === 0}
                    onClick={() => setCurrentMatchIndex(i => (i - 1 + matchInfo.total) % matchInfo.total)}
                    style={{ border: "1px solid #e0e0e0", background: "#fff", borderRadius: "4px", width: "26px", height: "26px", cursor: matchInfo.total ? "pointer" : "default", display: "grid", placeItems: "center", opacity: matchInfo.total ? 1 : 0.4 }}
                    title="Previous match"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button
                    disabled={matchInfo.total === 0}
                    onClick={() => setCurrentMatchIndex(i => (i + 1) % matchInfo.total)}
                    style={{ border: "1px solid #e0e0e0", background: "#fff", borderRadius: "4px", width: "26px", height: "26px", cursor: matchInfo.total ? "pointer" : "default", display: "grid", placeItems: "center", opacity: matchInfo.total ? 1 : 0.4 }}
                    title="Next match"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <button onClick={() => { setShowChatSearch(false); setChatSearchQuery(""); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#25d366", fontSize: "14px", fontWeight: 600, padding: "0 4px", flexShrink: 0 }}>Done</button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="wa-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`wa-bubble-wrap${msg.mine ? " wa-bubble-wrap--out" : ""}`}>
                  <div className={msg.mine ? "wa-bubble-out" : "wa-bubble-in"}>
                    {msg.file && (
                      msg.file.isImage && msg.file.blobUrl ? (
                        <img
                          src={msg.file.blobUrl}
                          alt={msg.file.name}
                          style={{ maxWidth: "220px", maxHeight: "200px", borderRadius: "6px", display: "block", marginBottom: msg.text ? "6px" : "4px", objectFit: "cover" }}
                        />
                      ) : (
                        <div className="wa-file-card">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.8 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <div className="wa-file-meta">
                            <span className="wa-file-name">{msg.file.name}</span>
                            <span className="wa-file-size">{(msg.file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </div>
                      )
                    )}
                    {msg.text && <span>{highlightMsg(msg.text, chatSearchQuery, msg.id)}</span>}
                    <span className="wa-bubble-time">
                      {msg.time}
                      {msg.mine && (
                        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ marginLeft: "3px", verticalAlign: "middle" }}>
                          <path d="M1 5.5l3.5 3.5L11 2" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 5.5l3.5 3.5L15 2" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf, image/png, image/jpeg, image/gif, image/webp, .xlsx, .xls, .docx, .doc, audio/*, video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 4.5 * 1024 * 1024) { alert("File must be under 4.5 MB."); return; }
                const isImage = IMAGE_TYPES.includes(f.type);
                setPendingUpload(f);
                setPendingBlobUrl(isImage ? URL.createObjectURL(f) : null);
                setShowPlusMenu(false);
                e.target.value = "";
              }}
            />

            {/* Input bar */}
            <div className="wa-input-bar">
              {/* Pending upload preview */}
              {pendingUpload && (
                <div className="wa-upload-preview">
                  <div className="wa-upload-card">
                    {pendingBlobUrl ? (
                      <img src={pendingBlobUrl} alt="" style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "4px", flexShrink: 0 }} />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    )}
                    <div className="wa-upload-meta">
                      <span className="wa-upload-name">{pendingUpload.name}</span>
                      <span className="wa-upload-size">{(pendingUpload.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <button className="wa-upload-remove" onClick={() => { setPendingUpload(null); setPendingBlobUrl(null); }}>×</button>
                  </div>
                </div>
              )}

              {/* Main row */}
              <div className="wa-input-row">
                {/* Plus / attach */}
                <div ref={plusWrapRef} style={{ position: "relative" }}>
                  <button className="wa-icon-btn" title="Attach file" onClick={(e) => { e.stopPropagation(); setShowPlusMenu((v) => !v); }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                  {showPlusMenu && (
                    <div className="wa-plus-menu">
                      <button className="wa-plus-item" onClick={(e) => { e.stopPropagation(); setShowPlusMenu(false); fileInputRef.current?.click(); }}>
                        Upload file
                      </button>
                    </div>
                  )}
                </div>

                {/* Text pill */}
                <div className="wa-input-pill">
                  <textarea
                    className="wa-input"
                    placeholder={isRecording ? "Recording audio..." : ""}
                    value={inputValue}
                    disabled={isRecording}
                    rows={1}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                  <button className="wa-icon-btn wa-emoji-btn" title="Emoji">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
                      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" strokeLinecap="round"/>
                      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Send or Mic */}
                {(inputValue.trim() || pendingUpload) ? (
                  <button className="wa-icon-btn" title="Send" onClick={handleSend}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#25d366">
                      <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
                    </svg>
                  </button>
                ) : (
                  <button
                    className={`wa-mic-btn${isRecording ? " wa-mic-btn--recording" : ""}`}
                    title={isRecording ? "Stop recording" : "Record voice note"}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? (
                      <div style={{ width: "12px", height: "12px", background: "#ea4335", borderRadius: "2px" }} />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="2" width="6" height="11" rx="3"/>
                        <path d="M5 10a7 7 0 0 0 14 0"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                        <line x1="9" y1="21" x2="15" y2="21"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="wa-empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="1.2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>

      {/* ── NEW CHAT POPUP ── */}
      {showNewChat && newChatPos && createPortal(
        <>
          {/* transparent click-catcher */}
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setShowNewChat(false)} />
          <div
            className="wa-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: newChatPos.top, left: newChatPos.centerX, transform: "translateX(-50%)", zIndex: 1000 }}
          >
            <div className="wa-modal-header" style={{ justifyContent: "center" }}>
              <span style={{ fontWeight: 600, fontSize: "16px", color: "#111b21" }}>New chat</span>
            </div>
            <div className="wa-modal-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Search contacts"
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                autoFocus
              />
              <button
                onClick={() => setShowNewChat(false)}
                style={{ flexShrink: 0, width: "20px", height: "20px", borderRadius: "50%", border: "none", background: "#b0b8bf", color: "#fff", fontSize: "13px", lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center" }}
                aria-label="Close"
              >×</button>
            </div>
            <div className="wa-modal-list">
              {newChatContacts.map(c => (
                <div
                  key={c.id}
                  className="wa-modal-contact"
                  onClick={() => { openChat(c.id); setShowNewChat(false); setShowArchivedView(false); if (archivedIds.has(c.id)) { setArchivedIds(prev => { const n = new Set(prev); n.delete(c.id); return n; }); } }}
                >
                  <div className="wa-avatar" style={{ background: c.color, width: "40px", height: "40px", fontSize: "14px", flexShrink: 0 }}>{c.initials}</div>
                  <span style={{ fontSize: "14px", color: "#111b21" }}>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {showDeleteConfirm && (
        <div className="wa-modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="wa-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: "16px", color: "#111b21", marginBottom: "8px" }}>Delete chat?</div>
            <div style={{ fontSize: "14px", color: "#667781", marginBottom: "20px" }}>
              This chat will be permanently deleted.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="wa-confirm-btn wa-confirm-btn--cancel" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="wa-confirm-btn wa-confirm-btn--delete" onClick={() => handleDeleteConfirm(showDeleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
