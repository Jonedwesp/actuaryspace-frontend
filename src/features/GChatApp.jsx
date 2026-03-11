// src/features/GChatApp.jsx
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { GCHAT_ID_MAP, normalizeGChatMessage } from "../utils/gchatUtils.js";
import { avatarFor } from "../utils/avatarUtils.js";
import { AC_EMAIL_MAP } from "../utils/appData.js";
import { formatGchatTime, formatLongDate, formatDividerDate, getGchatTimezone } from "../utils/dateTime.js";
import { formatChatText } from "../components/RightPanel.jsx";
import SmartLink from "../components/SmartLink.jsx";
import GChatSidebarMenu from "../components/GChatSidebarMenu.jsx";

function GChatEditBox({ initialText, onSave, onCancel }) {
  const [text, setText] = useState(initialText);
  const hasChanged = text.trim() !== initialText.trim();
  return (
    <div style={{ width: '100%', background: '#f1f3f4', padding: '10px 12px', borderRadius: '12px', border: '1px solid #dadce0', minWidth: '420px' }}>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        style={{ width: '100%', border: '1px solid #dadce0', borderRadius: '4px', padding: '12px 14px', fontSize: '14px', outline: 'none', minHeight: '90px', fontFamily: 'inherit', resize: 'none' }}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#5f6368', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>Cancel</button>
        {hasChanged && (
          <button onClick={() => onSave(text)} style={{ background: '#0b57d0', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 500, padding: '4px 16px', borderRadius: '16px' }}>Update</button>
        )}
      </div>
    </div>
  );
}

export function GChatApp({
  // --- Computed from middleContent ---
  filteredGchatSpaces,
  combinedContacts,
  debouncedChatSearchText,
  // --- State ---
  gchatMessages, setGchatMessages,
  gchatSelectedSpace, setGchatSelectedSpace,
  gchatSpaces, setGchatSpaces,
  gchatLoading, setGchatLoading,
  gchatError, setGchatError,
  gchatMe,
  gchatMsgLoading, setGchatMsgLoading,
  gchatMsgError, setGchatMsgError,
  gchatFilePreview, setGchatFilePreview,
  gchatDmNames, setGchatDmNames,
  gchatNextPageToken, setGchatNextPageToken,
  gchatLoadingOlder, setGchatLoadingOlder,
  gchatAutoScroll, setGchatAutoScroll,
  gchatSpaceTimes, setGchatSpaceTimes,
  archivedGchatSpaces, setArchivedGchatSpaces,
  trashedGchatSpaces, setTrashedGchatSpaces,
  mutedGchatSpaces, setMutedGchatSpaces,
  unreadGchatSpaces, setUnreadGchatSpaces,
  showArchivedChats, setShowArchivedChats,
  showNewChatModal, setShowNewChatModal,
  newChatPopupPos, setNewChatPopupPos,
  newChatTarget, setNewChatTarget,
  gchatSearchQuery, setGchatSearchQuery,
  chatSearchText, setChatSearchText,
  isChatSearchOpen, setIsChatSearchOpen,
  hoveredMsgId, setHoveredMsgId,
  editingMsgId, setEditingMsgId,
  editValue, setEditValue,
  callBtnHovered, setCallBtnHovered,
  reactions,
  reactionCounts,
  chatBarHeight, setChatBarHeight,
  showJumpToBottom, setShowJumpToBottom,
  dmsExpanded, setDmsExpanded,
  spacesExpanded, setSpacesExpanded,
  setNotifications,
  setIsLiveCallActive,
  setMsgToDelete,
  setChatToDelete,
  // --- Refs ---
  gchatBodyRef,
  newChatBtnRef,
  newChatEmailRef,
  messagesEndRef,
  pendingScrollAnchorRef,
  isProgrammaticScrollRef,
  dismissedNotifsRef,
  gchatMeRef,
  gchatSelectedSpaceRef,
  gchatDmNamesRef,
  pendingReactionsRef,
  myReactionsRef,
  myEditsRef,
  // --- Handlers ---
  handleStartChat,
  handleDeleteGChatMessage,
  handleUpdateGChatMessage,
  toggleReaction,
}) {
  // 🛡️ FIXED NAME SNIFFER: Uses correct scope variables to prevent blank screen crash
  const otherPersonName = gchatMessages.find((m) => {
    const sName = m.sender?.displayName || "";
    const sEmail = m.sender?.email || "";
    const sId = m.sender?.name || "";
    
    const activePersona = (import.meta.env.VITE_PERSONA || "SIYA").toUpperCase();

    const isMe = 
      (!!gchatMe && sId === gchatMe) || 
      (activePersona === "SIYA" && (sEmail.includes('siya@') || sName.toLowerCase().includes('siya') || sName.toLowerCase().includes('actuaryspace'))) ||
      (activePersona === "YOLANDIE" && (sName.toLowerCase().includes("yolandie") || sEmail.includes("yolandie@")));

    return !isMe && sName && !sName.includes("users/");
  })?.sender?.displayName;

  // 🔑 RELIABLE NAME: Scan messages using GCHAT_ID_MAP (covers sidebar+header)
  const msgDerivedName = (() => {
    const m = gchatMessages.find(msg => {
      const mSId = msg.sender?.name || "";
      const mSn = (msg.sender?.displayName || "").toLowerCase();
      const isMeMsg = (!!gchatMe && mSId === gchatMe) || mSn.includes("siya") || mSn.includes("actuaryspace");
      return !isMeMsg && (mSId || msg.sender?.displayName);
    });
    if (!m) return null;
    const mSId = m.sender?.name || "";
    const mName = GCHAT_ID_MAP[mSId] || m.sender?.displayName || "";
    return (mName && !mName.includes("users/") && mName !== "Direct Message") ? mName : null;
  })();

  if (gchatFilePreview) {
    const isImg = ["img", "png", "jpg", "jpeg", "gif", "webp"].includes(gchatFilePreview.type);
    const src = gchatFilePreview.url;

    return (
      <div className="gchat-preview-container">
        <div className="gchat-preview-bar">
          <div className="gchat-preview-title">{gchatFilePreview.name}</div>
          <div className="gchat-preview-actions">
            <a href={src} download={gchatFilePreview.name} className="gchat-preview-btn">Download</a>
            <button className="gchat-preview-close" onClick={() => setGchatFilePreview(null)}>
              ✕ Close
            </button>
          </div>
        </div>
        <div className="gchat-preview-body">
          {isImg ? (
            <img src={src} alt="Preview" className="gchat-preview-img" />
          ) : (
            <iframe src={src} title="Preview" className="gchat-preview-frame" />
          )}
        </div>
      </div>
    );
  }
    // If a file is selected, return the Preview UI *instead* of the Chat UI
    if (gchatFilePreview) {
      const isImg = ["img", "png", "jpg", "jpeg", "gif", "webp"].includes(gchatFilePreview.type);
      
      // ✅ CORRECT: The URL is already fully constructed in the onClick handler
      const src = gchatFilePreview.url;

      return (
        <div className="gchat-preview-container">
          <div className="gchat-preview-bar">
            <div className="gchat-preview-title">{gchatFilePreview.name}</div>
            <div className="gchat-preview-actions">
              <a href={src} download={gchatFilePreview.name} className="gchat-preview-btn">Download</a>
              <button className="gchat-preview-close" onClick={() => setGchatFilePreview(null)}>
                ✕ Close
              </button>
            </div>
          </div>
          <div className="gchat-preview-body">
            {isImg ? (
              <img src={src} alt="Preview" className="gchat-preview-img" />
            ) : (
              <iframe src={src} title="Preview" className="gchat-preview-frame" />
            )}
          </div>
        </div>
      );
    }

    // 👇 Standard Chat UI (If no preview is active)
    return (
      <div className="gchat-shell" style={{ display: "flex", height: "100%", position: "relative", background: "#fff", borderRadius: "12px", border: "1px solid #8993a4", boxShadow: "0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)", overflow: "hidden" }}>



      {/* LEFT SIDEBAR — widened to 32% */}
      <div
        className="gchat-sidebar"
        style={{
          width: "30%",
          borderRight: "1px solid #ddd",
          overflowY: "auto",
          padding: "12px 16px 12px 16px", 
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
        onClick={() => {}}
      >
{/* "Start direct message" Button */}
        <div ref={newChatBtnRef} style={{ width: "100%", paddingBottom: "16px", position: "relative" }}>
          <button 
            style={{ 
              width: "100%",
              padding: "10px 16px",
              borderRadius: "24px", 
              background: "#e3e3e3", 
              color: "#1f1f1f",
              border: "none",
              fontSize: "14px", 
              fontWeight: 500, 
              cursor: "pointer",
              textAlign: "center",
              transition: "background 0.2s ease"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#d6d6d6";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#e3e3e3";
            }}
            onMouseDown={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setNewChatPopupPos({ top: r.top, left: r.right + 8 }); setShowNewChatModal(true); }}
          >
            Start direct message
          </button>
        

        {/* Modal Overlay - Portalled to document.body to escape overflow:hidden + transforms */}
        {showNewChatModal && ReactDOM.createPortal(
          <>
            {/* Backdrop for instant close */}
            <div
              style={{ position: "fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex: 9998 }}
              onMouseDown={(e) => { e.stopPropagation(); setNewChatTarget(""); setShowNewChatModal(false); }}
            />
            
            <div
              className="popup-anim-in"
              style={{
                position: "fixed", top: newChatPopupPos.top, left: newChatPopupPos.left, width: "380px",
                background: "white", padding: "24px", borderRadius: "12px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.3)", zIndex: 9999, border: "1px solid #dadce0",
                transformOrigin: "top left"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{fontWeight:500, marginBottom:12, fontSize:"1rem", color:"#202124"}}>
                Start direct message
              </div>
              
              <div style={{fontSize:".8rem", color:"#5f6368", marginBottom:"4px"}}>
                Add 1 or more people
              </div>
              
             <div style={{ position: "relative" }}>
                <input 
                  ref={newChatEmailRef}
                  autoFocus
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "4px", border: "1px solid #dadce0", marginBottom: "16px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
                  placeholder="Search by name or enter email..."
                  value={newChatTarget}
                  onChange={(e) => setNewChatTarget(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStartChat()}
                />

                {(newChatTarget || "").length > 0 && !(newChatTarget || "").includes("@") && (
                  <div style={{
                    position: "absolute",
                    top: "42px",
                    left: "0",
                    right: "0",
                    background: "white",
                    border: "1px solid #dadce0",
                    boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                    zIndex: 9999,
                    maxHeight: "220px",
                    overflowY: "auto",
                    borderRadius: "6px"
                  }}>
                    
{Object.entries(combinedContacts)
  .filter(([name, email]) => 
    name.toLowerCase().includes((newChatTarget || "").toLowerCase()) || 
    email.toLowerCase().includes((newChatTarget || "").toLowerCase())
  )
  .map(([name, email]) => (
    <div 
      key={email}
      // ⚡ THE FIX: Auto-fill the email and immediately fire the Start Chat function
      onClick={async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // 1. Sync UI
  setNewChatTarget(email);
  if (newChatEmailRef.current) {
    newChatEmailRef.current.value = email;
  }

  // 2. 🧠 FORCE FULL EMAIL: Pass the full email directly to the function
  // This skips the state race condition and prevents the "partial email" error alert.
  handleStartChat(email); 
}}
      onMouseEnter={(e) => e.currentTarget.style.background = "#f8f9fa"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #f1f3f4"
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, fontSize: "13px", color: "#202124" }}>{name}</span>
        <span style={{ color: "#5f6368", fontSize: "11px" }}>{email}</span>
      </div>
      <div style={{ color: '#0b57d0', fontSize: '11px', fontWeight: 600 }}>Start Chat</div>
    </div>
  ))
}
                    {Object.entries(combinedContacts).filter(([n, e]) => n.toLowerCase().includes((newChatTarget || "").toLowerCase()) || e.toLowerCase().includes((newChatTarget || "").toLowerCase())).length === 0 && (
                      <div style={{ padding: "10px 14px", fontSize: "13px", color: "#5f6368", fontStyle: "italic" }}>
                        No contacts found
                      </div>
                    )}
                  </div>
                )}
              </div>
              
             <div style={{display:"flex", justifyContent:"flex-end", gap:10}}>
                 <button 
                  className="btn ghost" 
                  style={{ borderRadius:4, padding: "6px 12px", color: "#1a73e8", fontWeight: 500, cursor: "pointer", border: "none", background: "transparent" }} 
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setNewChatTarget(""); setShowNewChatModal(false); }}
                  disabled={gchatLoading}
                >
                  Cancel
                </button>
                <button 
                  className="btn blue" 
                  style={{ borderRadius:4, padding: "6px 16px", background: gchatLoading ? "#9aa0a6" : "#1a73e8", color: "#fff", fontWeight: 500, cursor: "pointer", border: "none" }} 
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleStartChat(); }}
                  disabled={gchatLoading}
                >
                  {gchatLoading ? "Starting..." : "Start chat"}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
        </div>

  {/* 🔍 GCHAT SEARCH BAR */}
                <div style={{ width: "100%", marginBottom: "16px", position: "relative", display: "flex", alignItems: "center" }}>
                  <svg 
                    style={{ position: "absolute", left: "14px", color: "#444746" }}
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                 <input 
                    type="text" 
                    placeholder="Search chat" 
                    value={gchatSearchQuery}
                    onChange={(e) => setGchatSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 16px 10px 42px",
                      borderRadius: "24px",
                      border: "none",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                      background: "#edf2fa",
                      color: "#1f1f1f"
                    }}
                  />
                </div>
{/* 🔙 BACK TO INBOX BUTTON (Top when in Archive View) */}
                {showArchivedChats && (
                  <div style={{ width: "100%", paddingBottom: "16px" }}>
                    <button 
                      style={{ 
                        width: "100%",
                        padding: "8px 16px",
                        borderRadius: "24px", 
                        background: "transparent", 
                        color: "#444746",
                        border: "1px solid #dadce0",
                        fontSize: "14px", 
                        fontWeight: 500, 
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        transition: "background 0.2s ease"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowArchivedChats(false);
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      Back to Inbox
                    </button>
                  </div>
                )}

                {gchatLoading && gchatSpaces.length === 0 && <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading…</div>}
                {gchatError && <div className="gchat-error">{gchatError}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: "3px", width: "100%", boxSizing: "border-box" }}>
            {(() => {
              const sortArchived = (list) => {
                const active = list.filter(s => !archivedGchatSpaces.includes(s.id || s.name));
                const archived = list.filter(s => archivedGchatSpaces.includes(s.id || s.name));
                return [...active, ...archived];
              };
              const dms = sortArchived(filteredGchatSpaces.filter(s => s && s.type === "DIRECT_MESSAGE"));
              const spaces = sortArchived(filteredGchatSpaces.filter(s => s && s.type !== "DIRECT_MESSAGE"));

              const renderSpaceItem = (s) => {
                if (!s) return null;
                const sKey = s.id || s.name;
                const learnedName = gchatDmNames[sKey] || "";

                let title = GCHAT_ID_MAP[sKey] || GCHAT_ID_MAP[s.displayName] || s.displayName || "Unnamed Space";

                if (s.type === "DIRECT_MESSAGE") {
                  title = GCHAT_ID_MAP[sKey] ||
                    GCHAT_ID_MAP[s.displayName] ||
                    (learnedName && !learnedName.includes("users/") && learnedName !== "Direct Message" ? learnedName : null) ||
                    ((gchatSelectedSpace?.id === s.id) ? msgDerivedName : null) ||
                    (s.displayName && !s.displayName.includes("users/") ? s.displayName : "Direct Message");
                }

                const isActive = gchatSelectedSpace?.id === s.id;
                
  // 🛡️ AUTHENTIC SERVER SYNC LOGIC:
                const sid = s.id || s.name;
                const apiActive = s.lastActiveTime ? new Date(s.lastActiveTime).getTime() : 0;
                
                // 🧠 THE SHIELD FIX: Trust the server's read state first, but allow local clicks to override
                const localReadTimeStr = gchatSpaceTimes[sid];
                const localReadTime = localReadTimeStr ? new Date(localReadTimeStr).getTime() : 0;
                const serverReadTime = s.serverLastReadTime ? new Date(s.serverLastReadTime).getTime() : 0;
                
                // Use the newest read time across all platforms (web, mobile, or local click)
                const effectiveReadTime = Math.max(localReadTime, serverReadTime);
                
                // Identify the last sender
                const lastSenderId = s.lastMessage?.sender?.name || "";
                const activePersona = (import.meta.env.VITE_PERSONA || "SIYA").toUpperCase();
                const isMe = lastSenderId === "users/112417469383977278282" || 
                             (gchatMe && lastSenderId === gchatMe) || 
                             (gchatMeRef.current && lastSenderId === gchatMeRef.current);
                
                // 🏁 THE FINAL TRIGGER:
                // Match Google Chat's exact rule: Unread if the last message is NOT mine AND it's newer than the last read event
                const isCurrentlySelected = gchatSelectedSpace?.id === sid || gchatSelectedSpace?.name === sid;
                const isUnread = !isCurrentlySelected && (
                  !!unreadGchatSpaces[sid] || 
                  (!isMe && apiActive > effectiveReadTime + 1000)
                );

                // For visual sorting and display
                let spaceTime = s.lastActiveTime || s.createTime;
              return (
                  <button
    key={s.id}
    // 🔵 Apply unread class for CSS bolding
    className={`gchat-item ${isActive ? "active" : ""} ${isUnread ? "unread" : ""}`}
    style={{
      width: "100%",
      maxWidth: "100%",
      margin: 0,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 16px",
      textAlign: "left",
      background: isActive ? "#c2e7ff" : (isUnread ? "#ffffff" : "#f1f3f4"),
      // 🔵 BOLD LOGIC: High contrast black and 800 weight for unread messages
      color: (isUnread && !isActive) ? "#000000" : (isActive ? "#001d35" : "#444746"),
      fontWeight: (isUnread && !isActive) ? "800" : (isActive ? "600" : "400"),
      border: isActive ? "1px solid #c2e7ff" : "1px solid #dadce0",
      cursor: "pointer",
      borderRadius: "24px",
      transition: "all 0.1s ease",
      fontSize: "13px"
    }}
    onClick={async () => {
      const spaceId = s.id || s.name;

      // Toggle: clicking the already-open chat closes it
      if (gchatSelectedSpace?.id === spaceId || gchatSelectedSpace?.name === spaceId) {
        setGchatSelectedSpace(null);
        return;
      }

      // Remove any provisional space that wasn't messaged (i.e. navigating away without sending)
      setGchatSpaces(prev => prev.filter(sp => !sp._provisional || (sp.id || sp.name) === spaceId));

      const cachedStr = localStorage.getItem(`GCHAT_MSGS_${spaceId}`);
      try { setGchatMessages(cachedStr ? JSON.parse(cachedStr) : []); }
      catch(e) { setGchatMessages([]); }
      setGchatAutoScroll(true);
      setShowJumpToBottom(false);

      setGchatSelectedSpace(s);

      // 1. Clear unread markers immediately in state and local storage
      setUnreadGchatSpaces(prev => {
        const next = { ...prev };
        delete next[spaceId];
        localStorage.setItem("GCHAT_UNREAD_SPACES", JSON.stringify(next));
        return next;
      });

      // 2. Set read time to exactly NOW
      const nowIso = new Date().toISOString();
      setGchatSpaceTimes(prev => ({ ...prev, [spaceId]: nowIso }));
      localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify({ ...gchatSpaceTimes, [spaceId]: nowIso }));

      // 3. Tell Google's servers this space is now read
      fetch("/.netlify/functions/gchat-mark-read", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId })
      }).catch(err => console.error("GChat mark-read failed", err));

      // 4. Clear any notifications from this space in the left panel
      setNotifications(prev => {
        const toRemove = prev.filter(x => x.alt === "Google Chat" && x.spaceId === spaceId);
        toRemove.forEach(x => { dismissedNotifsRef.current.add(x.id); });
        if (toRemove.length > 0) {
          localStorage.setItem("DISMISSED_NOTIFS", JSON.stringify(Array.from(dismissedNotifsRef.current)));
        }
        return prev.filter(x => !(x.alt === "Google Chat" && x.spaceId === spaceId));
      });
    }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = isUnread ? "#f0f4ff" : "#e8eaed")}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = isUnread ? "#ffffff" : "#f1f3f4")}
                  >
                 <div className="gchat-item-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: '8px' }}>
                      <div className="gchat-item-title" style={{ fontWeight: (isActive || isUnread) ? "700" : "500", color: isUnread && !isActive ? "#000000" : undefined, fontStyle: mutedGchatSpaces.includes(sid) ? "italic" : undefined }}>
                        {title}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {isUnread && !isActive && (
                        // 🔵 Authentic GChat Blue Notification Bubble
                        <div className="unread-dot" style={{
                          background: '#0b57d0',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          boxShadow: '0 0 4px rgba(11, 87, 208, 0.4)',
                          flexShrink: 0
                        }} />
                      )}
                      {mutedGchatSpaces.includes(sid) && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Muted" style={{ flexShrink: 0 }}>
                          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                          <line x1="4" y1="4" x2="20" y2="20"/>
                        </svg>
                      )}

        <GChatSidebarMenu
              sid={sid}
              s={s}
              showArchivedChats={showArchivedChats}
              gchatSpaceTimes={gchatSpaceTimes}
              setGchatSpaceTimes={setGchatSpaceTimes}
              setUnreadGchatSpaces={setUnreadGchatSpaces}
              setArchivedGchatSpaces={setArchivedGchatSpaces}
              mutedGchatSpaces={mutedGchatSpaces}
              setMutedGchatSpaces={setMutedGchatSpaces}
              setTrashedGchatSpaces={setTrashedGchatSpaces}
              gchatSelectedSpace={gchatSelectedSpace}
              setGchatSelectedSpace={setGchatSelectedSpace}
              setChatToDelete={setChatToDelete}
            />
                    </div>
                  </button>
           );
              };

              return (
                <>
                  {/* Direct Messages Section */}
                  {dms.length > 0 && (
                    <>
                      <div 
                        onClick={() => setDmsExpanded(!dmsExpanded)} 
                        style={{ display: "flex", alignItems: "center", padding: "8px 12px 4px 12px", cursor: "pointer", color: "#5f6368", fontSize: "12px", fontWeight: 600, letterSpacing: "0.8px", userSelect: "none" }}
                      >
                        <span style={{ flex: 1, textTransform: "uppercase" }}>Direct messages</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dmsExpanded ? "none" : "rotate(-90deg)", transition: "transform 0.1s" }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                      <div style={{ display: dmsExpanded ? "block" : "none" }}>{dms.map(renderSpaceItem)}</div>
                    </>
                  )}

                  {/* Spaces Section */}
                  {spaces.length > 0 && (
                    <>
                      <div 
                        onClick={() => setSpacesExpanded(!spacesExpanded)} 
                        style={{ display: "flex", alignItems: "center", padding: "16px 12px 4px 12px", cursor: "pointer", color: "#5f6368", fontSize: "12px", fontWeight: 600, letterSpacing: "0.8px", userSelect: "none" }}
                      >
                        <span style={{ flex: 1, textTransform: "uppercase" }}>Spaces</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: spacesExpanded ? "none" : "rotate(-90deg)", transition: "transform 0.1s" }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                      <div style={{ display: spacesExpanded ? "block" : "none" }}>{spaces.map(renderSpaceItem)}</div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

       {/* 📥 ARCHIVED CHATS BUTTON (Bottom when in Inbox View) */}
          {!showArchivedChats && (
            <div style={{ width: "100%", paddingTop: "16px", marginTop: "auto" }}>
              <button 
                style={{ 
                  width: "100%",
                  padding: "8px 16px",
                  borderRadius: "24px", 
                  background: "transparent", 
                  color: "#444746",
                  border: "1px solid #dadce0",
                  fontSize: "14px", 
                  fontWeight: 500, 
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "background 0.2s ease"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowArchivedChats(true);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8"></polyline>
                  <rect x="1" y="3" width="22" height="5"></rect>
                  <line x1="10" y1="12" x2="14" y2="12"></line>
                </svg>
                Archived Chats
              </button>
            </div>
          )}

      </div>
{/* RIGHT 3/4 — message thread */}
      <div
        className="gchat-thread"
        style={{
          width: "73%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden", /* 👈 THE FIX: Removed the duplicate outer scrollbar */
          position: "relative",
          background: "#fff"
        }}
      >
        <div
          className="gchat-topbar"
          style={{
            borderBottom: gchatSelectedSpace ? "1px solid #ddd" : "none",
            padding: "8px 24px 8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#fff"
          }}
        >
          {(() => {
              if (!gchatSelectedSpace) return null;
              const spaceKey = gchatSelectedSpace.id || gchatSelectedSpace.name;
              const cachedName = gchatDmNames[spaceKey] || "";
              const isDM = gchatSelectedSpace.type === "DIRECT_MESSAGE" || gchatSelectedSpace.spaceType === "DIRECT_MESSAGE";
              const resolvedTitle = (isDM || !gchatSelectedSpace.displayName || gchatSelectedSpace.displayName === "Direct Message" || gchatSelectedSpace.displayName.includes("users/"))
                ? (GCHAT_ID_MAP[spaceKey] ||
                   msgDerivedName ||
                   (cachedName && !cachedName.includes("users/") && cachedName !== "Direct Message" ? cachedName : null) ||
                   (otherPersonName && !otherPersonName.includes("users/") ? otherPersonName : null) ||
                   (gchatSelectedSpace.displayName && !gchatSelectedSpace.displayName.includes("users/") && gchatSelectedSpace.displayName !== "Direct Message" ? gchatSelectedSpace.displayName : (isDM ? "Direct Message" : "Unnamed Space")))
                : gchatSelectedSpace.displayName;
              const headerAvatar = avatarFor(resolvedTitle);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="gchat-avatar-circle" style={{ width: "36px", height: "36px", flexShrink: 0, flexBasis: "36px" }}>
                    {headerAvatar && <img key={headerAvatar} src={headerAvatar} alt={resolvedTitle} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = ""; }} />}
                    <span style={{ display: headerAvatar ? "none" : "" }}>{(resolvedTitle || "?").slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="gchat-top-title">{resolvedTitle}</div>
                </div>
              );
            })()}
          {gchatSelectedSpace && (() => {
            const spaceKey = gchatSelectedSpace.id || gchatSelectedSpace.name;
            const cachedName = gchatDmNames[spaceKey] || "";
            const callName = GCHAT_ID_MAP[spaceKey] ||
                   msgDerivedName ||
                   (cachedName && !cachedName.includes("users/") && cachedName !== "Direct Message" ? cachedName : null) ||
                   (otherPersonName && !otherPersonName.includes("users/") ? otherPersonName : null) ||
                   (gchatSelectedSpace.displayName && !gchatSelectedSpace.displayName.includes("users/") ? gchatSelectedSpace.displayName : "Chat");

            return (
             <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {isChatSearchOpen && (
                  <input
                    type="text"
                    placeholder="Search in conversation..."
                    value={chatSearchText}
                    onChange={(e) => setChatSearchText(e.target.value)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "24px",
                      border: "1px solid #dadce0",
                      fontSize: "14px",
                      outline: "none",
                      width: "200px",
                      background: "#f1f3f4"
                    }}
                  />
                )}
                <button
                  title="Search in conversation"
                  onClick={() => {
                    setIsChatSearchOpen(!isChatSearchOpen);
                    if (isChatSearchOpen) setChatSearchText("");
                  }}
                  style={{
                    background: isChatSearchOpen ? "#e8f0fe" : "#f1f3f4",
                    border: "none",
                    cursor: "pointer",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    color: isChatSearchOpen ? "#1a73e8" : "#444746",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#e3e3e3"}
                  onMouseLeave={(e) => e.currentTarget.style.background = isChatSearchOpen ? "#e8f0fe" : "#f1f3f4"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
        <div 
                              style={{ position: "relative" }}
                              onMouseEnter={() => setCallBtnHovered(true)}
                              onMouseLeave={() => setCallBtnHovered(false)}
                            >
                              <a
                                href="https://meet.google.com/new?authuser=siyabonga@actuaryconsulting.co.za"
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Call ${callName}`}
                                onClick={async (e) => {
                                  e.preventDefault(); // 👈 Prevents native link opening so we can control the tab update
                                  setCallBtnHovered(false); // Hide tooltip on click
                                  const now = new Date();
                                  const startTime = now.toISOString();
                                  const endTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

                                  window.dispatchEvent(new CustomEvent("googleMeetLaunched"));
                                  
                                  // Open in a new tab instead of the split-pane workspace (bypasses iframe restrictions)
                                  const meetTab = window.open('https://meet.google.com/new?authuser=siyabonga@actuaryconsulting.co.za', '_blank');

                                  // Trigger the NLM Video playback after a 4-second delay (simulating answer)
                                  setTimeout(() => {
                                    setIsLiveCallActive(true);
                                  }, 4000);

                                  try {
                                    const res = await fetch("/.netlify/functions/calendar-create", {
                                      method: "POST",
                                      credentials: "include",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        summary: `Chat Call: ${callName}`,
                                        start: { dateTime: startTime },
                                        end: { dateTime: endTime }
                                      }),
                                    });
                                    const json = await res.json();
                                    
                                    if (json.ok && json.event?.hangoutLink) {
                                      const meetUrl = json.event.hangoutLink;
                                      const separator = meetUrl.includes('?') ? '&' : '?';
                                      const authUrl = `${meetUrl}${separator}authuser=siyabonga@actuaryconsulting.co.za`;
                                      
                                      // Update the new tab to the generated meeting URL
                                      if (meetTab) meetTab.location.href = authUrl; 
                                      
                                      await fetch("/.netlify/functions/gchat-send", {
                                        method: "POST",
                                        credentials: "include",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          space: gchatSelectedSpace.id,
                                          text: `I'm starting a video call. Join here: ${meetUrl}`,
                                        }),
                                      });
                                    } else {
                                      throw new Error("Could not generate host link");
                                    }
                                  } catch (err) {
                                    console.error("Failed to start impersonated call", err);
                                  }
                                }}
                                onContextMenu={() => {
                                  // 🚀 ARM FOR SPLIT VIEW: Prepares the app to watch for the window shrinking
                                  window.dispatchEvent(new CustomEvent("armedForSplitView"));
                                }}
                                style={{
                                  background: "#f1f3f4",
                                  border: "none",
                                  cursor: "pointer",
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "50%",
                                  display: "grid",
                                  placeItems: "center",
                                  color: "#444746",
                                  transition: "background 0.2s",
                                  textDecoration: "none" // 👈 Keeps it looking exactly like the button
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#e3e3e3"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "#f1f3f4"}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                              </a>

                          {callBtnHovered && (
                                <div style={{
                                  position: "absolute",
                                  top: "100%",
                                  right: 0,
                                  marginTop: "8px",
                                  backgroundColor: "#f1f3f4",
                                  color: "#202124",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  whiteSpace: "normal",
                                  width: "120px",
                                  textAlign: "center",
                                  lineHeight: "1.4",
                                  zIndex: 999999,
                                  boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                                  pointerEvents: "none",
                                  fontFamily: "system-ui, -apple-system, sans-serif"
                                }}>
                                  Right-click for more options...
                                  <div style={{
                                    content: '""',
                                    position: "absolute",
                                    bottom: "100%",
                                    right: "14px",
                                    borderWidth: "6px",
                                    borderStyle: "solid",
                                    borderColor: "transparent transparent #f1f3f4 transparent"
                                  }} />
                                </div>
                              )}
                            </div>
              </div>
            );
          })()}
        </div>

<div
              className="gchat-thread-body"
              ref={gchatBodyRef}
              onScroll={() => {
                if (isProgrammaticScrollRef.current) {
                  isProgrammaticScrollRef.current = false;
                  return;
                }
                const el = gchatBodyRef.current;
                if (!el) return;

                const atBottom =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 300;

              setGchatAutoScroll(atBottom);
                setShowJumpToBottom(!atBottom);
              }}
              style={{
                flex: 1,
                overflowY: "auto",
                overflowAnchor: "none",
                padding: `28px 24px ${chatBarHeight}px 12px`,
                scrollBehavior: "auto"
              }}
            >
          {!gchatSelectedSpace && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#bdc1c6", fontSize: "20px", fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>Select a space...</span>
            </div>
          )}

          {gchatSelectedSpace && (
            <>
              {gchatMsgLoading && <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading messages…</div>}
              {gchatMsgError && <div className="gchat-error">{gchatMsgError}</div>}

              {!gchatMsgLoading && !gchatMsgError && (
               <div className="gchat-msg-list">
                  {/* 🟢 PAGINATION BUTTON: Appears only if older messages exist */}
                  {gchatNextPageToken && (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      <button 
                        className="t-btn-gray" 
                        style={{ fontSize: '13px', borderRadius: '20px', opacity: gchatLoadingOlder ? 0.6 : 1 }}
                        disabled={gchatLoadingOlder} // 🛡️ Prevent double-clicking
                        onClick={async (e) => {
                          e.stopPropagation();
                          setGchatLoadingOlder(true); // 🕒 Start loading
                          try {
                            // Find oldest message in current state for timestamp-based pagination
                            const sortedMsgs = [...gchatMessages].sort((a, b) => new Date(a.createTime) - new Date(b.createTime));
                            const oldestTime = sortedMsgs[0]?.createTime;
                            if (!oldestTime) { setGchatLoadingOlder(false); return; }
                            // Use timestamp filter — reliable deep history, no token expiry issues
                            const res = await fetch(`/.netlify/functions/gchat-messages?space=${encodeURIComponent(gchatSelectedSpace.id)}&before=${encodeURIComponent(oldestTime)}`, { credentials: "include" });
                            const json = await res.json();
                            if (json.ok) {
                              const older = (json.messages || []).map(normalizeGChatMessage);
                              if (older.length > 0) {
                                if (gchatBodyRef.current) pendingScrollAnchorRef.current = gchatBodyRef.current.scrollHeight;
                                setGchatMessages(prev => dedupeMergeMessages(older, prev));
                              }
                              // Hide button only when API returns nothing (reached beginning of chat)
                              if (older.length < 1000) setGchatNextPageToken(null);
                              else setGchatNextPageToken("has_more");
                            }
                          } catch (err) { console.error("Load older failed", err); }
                          setGchatLoadingOlder(false); // ✅ Stop loading
                        }}
                      >
                        {gchatLoadingOlder ? "Loading older messages..." : "Load older messages"}
                      </button>
                    </div>
                  )}

                  {/* 🏁 AUTHENTIC CONVERSATION START HEADER (Replica of Screenshot 23) */}
                  {!gchatNextPageToken && !gchatMsgLoading && gchatSelectedSpace && (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      padding: '48px 20px 0px 20px', 
                      textAlign: 'center'
                    }}>
                      {/* 👤 Large Avatar */}
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '12px', overflow: 'hidden', background: '#f1f3f4', display: 'grid', placeItems: 'center' }}>
                        {(() => {
                          const name = gchatDmNames[gchatSelectedSpace.id] || msgDerivedName || gchatSelectedSpace.displayName || "C";
                          const img = avatarFor(name);
                          return img ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '32px', fontWeight: '500', color: '#5f6368' }}>{name[0].toUpperCase()}</span>;
                        })()}
                      </div>

                      {/* 📛 Name & Email Block */}
                      {(() => {
                        const name = gchatDmNames[gchatSelectedSpace.id] || msgDerivedName || gchatSelectedSpace.displayName || "Direct Message";
                        // ⚡ FIX: Use the combinedContacts lookup with the cleaned name
                        const emailAddress = combinedContacts[name] || AC_EMAIL_MAP[name]; 
                        return (
                          <>
                            <div style={{ fontSize: '22px', fontWeight: '500', color: '#1f1f1f', marginBottom: '4px', fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>{name}</div>
                            {emailAddress && <div style={{ fontSize: '14px', color: '#444746', marginBottom: '4px' }}>{emailAddress}</div>}
                            <div style={{ fontSize: '14px', color: '#444746', marginBottom: '24px' }}>{getGchatTimezone()}</div>
                            
                            {/* 🕒 Creation Milestone (Moved ABOVE the box) */}
                            <div style={{ fontSize: '13.5px', color: '#1f1f1f', marginBottom: '24px' }}>
                              {gchatSelectedSpace.createTime 
                                ? `You created this chat on ${formatLongDate(gchatSelectedSpace.createTime)}.` 
                                : `This is the very beginning of your direct message history with ${name}.`}
                            </div>
                            
                            {/* 🕒 HISTORY STATUS BOX (Material Style) */}
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '12px', 
                              background: '#f8f9fa', 
                              padding: '12px 16px', 
                              borderRadius: '8px', 
                              textAlign: 'left',
                              maxWidth: '400px',
                              width: 'fit-content',
                              marginBottom: '40px',
                              border: '1px solid #f1f3f4'
                            }}>
                              <div style={{ color: '#444746', display: 'flex' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1f1f1f', letterSpacing: '0.8px', textTransform: 'uppercase' }}>History is on</div>
                                <div style={{ fontSize: '13px', color: '#444746' }}>Messages are saved.</div>
                              </div>
                            </div>

                            {/* 📅 STANDALONE DATE DIVIDER (Full Width Border) */}
                            <div style={{ 
                              width: '100%', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              margin: '10px 0 30px 0',
                              position: 'relative'
                            }}>
                              <div style={{ position: 'absolute', width: '100%', height: '1px', background: '#f1f3f4', zIndex: 1 }}></div>
                              <div style={{ 
                                fontSize: '11px', 
                                fontWeight: '700', 
                                color: '#444746', 
                                padding: '0 16px', 
                                background: '#fff', 
                                position: 'relative', 
                                zIndex: 2,
                                textTransform: 'uppercase',
                                letterSpacing: '0.4px'
                              }}>
                                {gchatMessages.length > 0 
                                  ? formatDividerDate(gchatMessages[0].createTime) 
                                  : formatDividerDate(new Date().toISOString())}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {/* 🛡️ PERMANENT SIYA LOCK: Siya (Right) vs Others (Left). Reactions & Hover preserved. */}
                  <style>{`
                    .gchat-hover-actions { opacity: 0; pointer-events: none; transition: opacity 0.1s ease-in-out; }
                    .gchat-msg-content:hover .gchat-hover-actions { opacity: 1; pointer-events: auto; }
                  `}</style>
                  {gchatMessages.filter(m => {
                    if (!debouncedChatSearchText.trim()) return true;
                    const msg = normalizeGChatMessage(m);
                    // 🔍 IMPROVED: Check both text and formattedText to ensure no results are missed
                    const content = ((msg.text || "") + " " + (msg.formattedText || "")).toLowerCase();
                    return content.includes(debouncedChatSearchText.toLowerCase());
                  }).map((m, idx) => {
                    const msg = normalizeGChatMessage(m);
                    const rawName = msg?.sender?.displayName || "";
                    const spaceKey = gchatSelectedSpace?.id || gchatSelectedSpace?.name || "";
                    const cachedName = gchatDmNames[spaceKey] || "";
                    
                    const activePersona = (import.meta.env.VITE_PERSONA || "SIYA").toUpperCase();

                    // 🧠 CHECK IF IT'S MINE BEFORE ASSIGNING A NAME
                    const isMine = (!!gchatMe && msg?.sender?.name === gchatMe) || 
                                   (activePersona === "SIYA" && (rawName.toLowerCase().includes("siya") || rawName.toLowerCase().includes("actuaryspace") || msg?.sender?.email?.includes("siya@"))) ||
                                   (activePersona === "YOLANDIE" && (rawName.toLowerCase().includes("yolandie") || msg?.sender?.email?.includes("yolandie@")));

                    // 🧠 ENFORCE CORRECT NAME (STRICT FULL NAME HIERARCHY)
let senderName = "Colleague";
const senderId = msg?.sender?.name || ""; 
const senderEmail = msg?.sender?.email || "";

// 1. Check the Master ID Map (Highest Priority for exact matches)
if (GCHAT_ID_MAP[senderId]) {
  senderName = GCHAT_ID_MAP[senderId];
} 
// 2. Check for Drive/Bot messages
else if (msg?.sender?.type === "BOT" || (msg?.text && msg.text.includes("shared ") && msg.text.includes(" with you"))) {
  senderName = "Google Drive";
} 
// 3. Check if it's the active Persona
else if (isMine) {
  senderName = activePersona === "YOLANDIE" ? "Yolandie" : "Siyabonga Nono";
} 
// 4. Lookup email in our deduplicated contact list to find the Full Name
else {
  const contactMatch = Object.entries(combinedContacts).find(([name, email]) => email.toLowerCase() === senderEmail.toLowerCase());
  if (contactMatch) {
    senderName = contactMatch[0];
  } else if (rawName && !rawName.includes("users/")) {
    senderName = rawName;
  } else if (cachedName && !cachedName.includes("users/") && cachedName !== "Direct Message") {
    senderName = cachedName;
  } else if (gchatSelectedSpace?.displayName && !gchatSelectedSpace.displayName.includes("users/") && gchatSelectedSpace.displayName !== "Direct Message") {
    senderName = gchatSelectedSpace.displayName;
  }
}

                    const msgId = msg?.name || msg?.id || `msg-${idx}`;
                    
                    // 🧠 DRIVE DETECTION: Defined here so both name and avatar can use it
                    const isDriveMsg = msg?.sender?.type === "BOT" || (msg?.text && msg.text.includes("shared ") && msg.text.includes(" with you"));
                    
                    const avatar = isDriveMsg ? "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" : avatarFor(senderName);

                    const hasAttachment = msg.attachment && msg.attachment.length > 0;
                    const fileData = hasAttachment ? msg.attachment[0] : null;
                    const fileName = fileData?.contentName || fileData?.name || "Attachment";
                    const ext = fileName.split(".").pop().toLowerCase();
                    
                    const isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext);
                    const isAudio = ["mp3", "wav", "m4a", "aac", "ogg", "opus", "flac"].includes(ext);

                    let fileType = "FILE";
                    let iconClass = "default";
                    if (ext === "pdf") { fileType = "PDF"; iconClass = "pdf"; }
                    else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) { fileType = "IMG"; iconClass = "img"; }
                    else if (["xls", "xlsx", "csv"].includes(ext)) { fileType = "XLS"; iconClass = "xls"; }
                    else if (["doc", "docx"].includes(ext)) { fileType = "DOC"; iconClass = "doc"; }

                  const contentType = fileData?.contentType || "";
                    if (fileType === "FILE") {
                      if (contentType.includes("google-apps.document")) { fileType = "DOC"; iconClass = "doc"; }
                      else if (contentType.includes("google-apps.spreadsheet")) { fileType = "XLS"; iconClass = "xls"; }
                    }

              // 🔍 UNIVERSAL MEET LINK FINDER: Extracts hidden Meet URLs from incoming cards
                                    const msgString = JSON.stringify(msg);
                                    // Match meet.google.com with or without https:// (safely matching the 3-4-3 format specifically)
                                    const meetMatch = msgString.match(/(?:https:\/\/)?meet\.google\.com\/[a-z0-9-]+/i);
                                    let incomingMeetUrl = meetMatch ? meetMatch[0] : null;
                                    if (incomingMeetUrl && !incomingMeetUrl.startsWith('http')) {
                                        incomingMeetUrl = 'https://' + incomingMeetUrl;
                                    }

               // 🧠 REPOSITORY CALL FIX: Treat empty interactive cards from the Repository as Incoming Calls
                                    const isSystemCard = !msg?.text && !msg?.formattedText && !msg?.fallbackText && !hasAttachment;
                                    if (!incomingMeetUrl && isSystemCard && (senderName === "Repository" || msg?.sender?.type === "BOT")) {
                                        incomingMeetUrl = "https://meet.google.com/incoming-call"; // Dummy link to trigger the SmartLink interceptor
                                    }

                                    // 🧠 CALL FIX: Hide boilerplate text for ALL Meet links
                                    const isCallBoilerplate = incomingMeetUrl && (msg?.text || "").includes("I'm starting a video call");

                                  return (
                              <div 
                        key={msgId} 
                        className={`gchat-msg ${isMine ? "mine" : "theirs"}`} 
                        style={{ 
                          position: "relative",
                          display: "flex", 
                          width: "100%",
                          // 🚀 ALIGNMENT ANCHOR 1: Row-level force
                          justifyContent: isMine ? "flex-end" : "flex-start", 
                          marginBottom: "12px",
                          gap: "8px"
                        }}
                      >
                        {!isMine && (
                          <div className="gchat-avatar-circle" style={{ alignSelf: 'flex-start', flexShrink: 0 }}>
                            {avatar && <img key={avatar} src={avatar} alt={senderName} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = ""; }} />}
                            <span style={{ display: avatar ? "none" : "" }}>{senderName.slice(0, 1).toUpperCase()}</span>
                          </div>
                        )}

                        <div 
                          className="gchat-msg-content group" 
                          style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            // 🚀 ALIGNMENT ANCHOR 2: Content-level force
                            alignItems: isMine ? "flex-end" : "flex-start", 
                            position: "relative", 
                            maxWidth: "70%",
                            width: "fit-content", // 👈 SHIELD: Prevents empty space from acting as a hover zone
                            marginLeft: isMine ? "auto" : "0", // 🧲 Magnetic pull to right
                            marginRight: isMine ? "0" : "auto"
                          }}
                        >
                          {/* 🛠️ UNIVERSAL HOVER ACTION BAR (Reactions + Edit + Delete) */}
                          {!editingMsgId && !msg.isDeletedLocally && msg.text !== "Message deleted by its author" && (
                            <div className="gchat-hover-actions" style={{
                              position: 'absolute', top: '-22px', [isMine ? 'right' : 'left']: '0px',
                              background: 'white', border: '1px solid #dadce0', borderRadius: '24px',
                              display: 'flex', gap: '8px', padding: '4px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 100
                            }}>
                              <button title="Like" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleReaction(msgId, "like"); }} style={{border:'none', background:'none', cursor:'pointer', fontSize: '16px'}}>👍</button>
                              <button title="Heart" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleReaction(msgId, "heart"); }} style={{border:'none', background:'none', cursor:'pointer', fontSize: '16px'}}>❤️</button>
                              <button title="Laugh" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleReaction(msgId, "laugh"); }} style={{border:'none', background:'none', cursor:'pointer', fontSize: '16px'}}>😆</button>
                              {isMine && (
                                <>
                                  <button title="Edit" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditingMsgId(msgId); setEditValue(msg.text || ""); }} style={{border:'none', background:'none', cursor:'pointer', color:'#5f6368', display: 'grid', placeItems: 'center'}}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                  </button>
                                  <button title="Delete" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteGChatMessage(msgId); }} style={{border:'none', background:'none', cursor:'pointer', color:'#d93025', display: 'grid', placeItems: 'center'}}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        <div className="gchat-meta" style={{ textAlign: isMine ? "right" : "left", width: "100%" }}>
                            {!isMine && <strong style={{ marginRight: '4px' }}>{senderName}</strong>}
                            <span className="gchat-time" style={{ marginLeft: isMine ? "0" : "2px", marginRight: isMine ? "8px" : "0" }}>
                              {formatGchatTime(msg?.createTime)}
                              {(msg.isEditedLocally || (msg.updateTime && msg.createTime && msg.updateTime !== msg.createTime)) && !msg.isDeletedLocally && msg.text !== "Message deleted by its author" && " • Edited"}
                            </span>
                          </div>

                  {editingMsgId === msgId ? (
                            <GChatEditBox 
                              initialText={msg?.text || msg?.formattedText || ""}
                              onSave={(newText) => handleUpdateGChatMessage(msgId, newText)}
                              onCancel={() => setEditingMsgId(null)}
                            />
                          ) : (
                            <div 
                              className="gchat-pill-strict" 
                              onMouseEnter={(e) => { e.stopPropagation(); setHoveredMsgId(msgId); }}
                              onMouseLeave={(e) => { e.stopPropagation(); setHoveredMsgId(null); }}
                              style={{ 
                                position: "relative", textAlign: 'left', 
                                width: 'fit-content', display: 'inline-block', alignSelf: isMine ? 'flex-end' : 'flex-start',
                                fontStyle: (msg.isDeletedLocally || msg.text === "Message deleted by its author") ? 'italic' : 'normal',
                                color: (msg.isDeletedLocally || msg.text === "Message deleted by its author") ? '#5f6368' : '#202124',
                                backgroundColor: (msg.isDeletedLocally || msg.text === "Message deleted by its author") 
                                  ? '#f1f3f4' 
                                  : (hoveredMsgId === msgId ? (isMine ? "#cbdcf8" : "#e8eaed") : (isMine ? "#c2e7ff" : "#f1f3f4")),
                                border: (msg.isDeletedLocally || msg.text === "Message deleted by its author") ? '1px solid #dadce0' : '1px solid transparent',
                                transition: "background-color 0.15s ease",
                                padding: "8px 16px",
                                borderRadius: "18px",
                                margin: 0,
                                fontSize: "14px",
                                lineHeight: "1.5",
                                wordBreak: "break-word"
                              }}
                            >
                          {hasAttachment && !msg.isDeletedLocally && msg.text !== "Message deleted by its author" && (
                                <div style={{ marginBottom: msg?.text ? "8px" : "0" }}>
                                  {(() => {
                                    const finalUrl = fileData?.attachmentDataRef?.resourceName ? `/.netlify/functions/gchat-download?uri=api:${fileData.attachmentDataRef.resourceName}` : fileData?.downloadUri;
const isImg = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
const isPdf = ext === "pdf";
const isWord = ["doc", "docx"].includes(ext);
  const isXls = ["xls", "xlsx", "csv"].includes(ext);

  if (isWord || isXls) {
    const badgeColor = isWord ? "#1a73e8" : "#188038";
    const badgeLabel = isWord ? "DOC" : "XLS";
    const previewType = isWord ? "doc" : "xls";

    return (
      <div 
        style={{ 
          marginBottom: "8px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #dadce0",
          cursor: "pointer",
          background: "#fff",
          height: "180px",
          display: "flex",
          flexDirection: "column",
          width: "280px",
          boxShadow: "0 1px 2px rgba(60,64,67,0.3)"
        }} 
        onClick={(e) => { 
          e.stopPropagation(); 
          setGchatFilePreview({ name: fileName, url: finalUrl, type: previewType }); 
        }}
      >
         <div style={{ 
           flex: 1, 
           background: "#f8f9fa", 
           display: "flex", 
           flexDirection: "column",
           alignItems: "center", 
           justifyContent: "center",
           padding: "20px" 
         }}>
            <div style={{ 
              width: "60px", 
              height: "60px", 
              background: badgeColor, 
              borderRadius: "8px", 
              display: "grid", 
              placeItems: "center",
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
            }}>
              <span style={{ color: "#fff", fontSize: "24px", fontWeight: "bold" }}>
                {isWord ? "W" : "X"}
              </span>
            </div>
         </div>
         <div style={{ 
           background: "#fff", 
           padding: "10px 16px", 
           borderTop: "1px solid #f1f3f4", 
           display: "flex", 
           alignItems: "center", 
           gap: "10px" 
         }}>
            <div style={{ 
              background: badgeColor,
              color: "white",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: "bold",
              flexShrink: 0,
              whiteSpace: "nowrap",
              minWidth: "32px",
              textAlign: "center"
            }}>
              {badgeLabel}
            </div>
            <span style={{ 
              fontSize: "13px", 
              color: "#1f1f1f", 
              whiteSpace: "nowrap", 
              overflow: "hidden", 
              textOverflow: "ellipsis",
              fontWeight: 500 
            }}>
              {fileName}
            </span>
         </div>
      </div>
    );
  }

                                  // 🟢 Word & Excel Preview: Use Google Docs Viewer Proxy
                                    if (isWord || isXls) {
                                      const absoluteUrl = `${window.location.origin}${finalUrl}`;
                                      const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;
                                      const badgeColor = isWord ? "#1a73e8" : "#188038";
                                      const badgeLabel = isWord ? "DOC" : "XLS";

                                      return (
                                        <div style={{ marginBottom: "8px", borderRadius: "12px", overflow: "hidden", border: "1px solid #dadce0", cursor: "pointer", background: "#f1f3f4", height: "160px", display: "flex", flexDirection: "column", width: "280px" }} onClick={(e) => { e.stopPropagation(); setGchatFilePreview({ name: fileName, url: finalUrl, type: iconClass }); }}>
                                           <div style={{ flex: 1, overflow: "hidden", background: "#f1f3f4", pointerEvents: "none" }}>
                                              <iframe title={fileName} src={viewerUrl} style={{ width: "100%", height: "100%", border: "none" }} />
                                           </div>
                                           <div style={{ background: "#fff", padding: "8px 12px", borderTop: "1px solid #dadce0", display: "flex", alignItems: "center", gap: "8px" }}>
                                              <span style={{ background: badgeColor, color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap", minWidth: "32px", textAlign: "center" }}>{badgeLabel}</span>
                                              <span style={{ fontSize: "12px", color: "#3c4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</span>
                                           </div>
                                        </div>
                                      );
                                    }

                                    // PDF preview card — direct iframe so browser renders first page natively
                                    if (isPdf) {
                                      return (
                                        <div style={{ marginBottom: "8px", borderRadius: "12px", overflow: "hidden", border: "1px solid #dadce0", cursor: "pointer", background: "#f1f3f4", height: "160px", display: "flex", flexDirection: "column", width: "280px" }} onClick={(e) => { e.stopPropagation(); setGchatFilePreview({ name: fileName, url: finalUrl, type: "pdf" }); }}>
                                          <div style={{ flex: 1, overflow: "hidden", background: "#fff", pointerEvents: "none" }}>
                                            <iframe title={fileName} src={`${finalUrl}#toolbar=0&navpanes=0&scrollbar=0`} style={{ width: "100%", height: "500px", border: "none", marginTop: "0" }} />
                                          </div>
                                          <div style={{ background: "#fff", padding: "8px 12px", borderTop: "1px solid #dadce0", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ background: "#ea4335", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap", minWidth: "32px", textAlign: "center" }}>PDF</span>
                                            <span style={{ fontSize: "12px", color: "#3c4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</span>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Inline image preview
                                    if (isImg) {
                                      return (
                                        <div style={{ marginBottom: "8px", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setGchatFilePreview({ name: fileName, url: finalUrl, type: "img" }); }}>
                                          <img
                                            src={finalUrl}
                                            alt={fileName}
                                            style={{ maxWidth: "420px", maxHeight: "320px", borderRadius: "12px", display: "block", objectFit: "contain" }}
                                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                                          />
                                        </div>
                                      );
                                    }

                                    // Audio / Voice Note player
                                    if (isAudio || contentType.startsWith("audio/")) {
                                      return (
                                        <div style={{ marginBottom: "8px" }}>
                                          <audio controls src={finalUrl} style={{ width: "240px", height: "36px", outline: "none", display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                        </div>
                                      );
                                    }

                                    // Standard Fallback
                                    return (
                                      <div className="gchat-file-card" onClick={(e) => {
                                        e.stopPropagation();
                                        // ⚡ INCLUDED EXCEL: Ensures clicking the standard card also triggers the preview modal
                                        const isViewable = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "doc", "docx", "xls", "xlsx", "csv"].includes(ext);
                                        if (isViewable) { setGchatFilePreview({ name: fileName, url: finalUrl, type: iconClass }); }
                                        else { window.open(finalUrl, '_blank'); }
                                      }}>
                                        <div className={`gchat-file-icon ${iconClass}`}>{fileType}</div>
                                        <div className="gchat-file-info"><div className="gchat-file-name">{fileName}</div></div>
                                      </div>
                                    );
                                  })()}
                                </div>
                            )}
                {/* 1. Render actual text or fallback text from Google Chat cards */}
                                  {!isCallBoilerplate && (msg?.text || msg?.formattedText || msg?.fallbackText) && formatChatText(msg?.text || msg?.formattedText || msg?.fallbackText, debouncedChatSearchText)}
                                  
                                  {/* 2. Render Incoming Meet Links */}
                                  {incomingMeetUrl && (
                                    <div style={{ marginTop: (!isCallBoilerplate && (msg?.text || msg?.formattedText || msg?.fallbackText)) ? "8px" : "0px" }}>
                                      <SmartLink
                                        url={incomingMeetUrl}
                                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: isMine ? "#34a853" : "#1a73e8", color: "#fff", border: "none", borderRadius: "100px", fontSize: "13px", fontWeight: 500, textDecoration: "none", cursor: "pointer" }}
                                        setIsLiveCallActive={setIsLiveCallActive}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z"/></svg>
                                        {isMine ? "Rejoin Video Call" : "Join Video Call"}
                                      </SmartLink>
                                    </div>
                                  )}

                              {/* 3. Render a fallback if the message is a completely empty system card */}
                              {(!msg?.text && !msg?.formattedText && !msg?.fallbackText && !hasAttachment && !incomingMeetUrl) && (
                                <div style={{ color: "#5f6368", fontStyle: "italic", fontSize: "13px" }}>
                                  Interactive Card / System Event
                                </div>
                              )}
                            </div>
                          )}
                                  
                                  {/* Reaction Chips Row */}
                                  {Array.isArray(reactions[msgId]) && reactions[msgId].length > 0 && !msg.isDeletedLocally && msg.text !== "Message deleted by its author" && (
                            <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                              {reactions[msgId].map((r) => (
                                <button key={r} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleReaction(msgId, r); }} className="gchat-reaction-chip-btn">
                                  {r === "like" ? "👍" : r === "heart" ? "❤️" : "😆"} {reactionCounts[msgId]?.[r] || 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                   );
                 })}
                  <div ref={messagesEndRef} style={{ height: "80px", flexShrink: 0 }} />
                </div>
              )}
            </>
          )}
        </div>

       {showJumpToBottom && (
          <button
            onClick={() => {
              const el = gchatBodyRef.current;
              isProgrammaticScrollRef.current = true;
              if (el) el.scrollTop = el.scrollHeight;
              setGchatAutoScroll(true);
              setShowJumpToBottom(false);
            }}
            style={{
              position: 'absolute',
              bottom: '85px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#0b57d0',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              fontFamily: "'Google Sans', Roboto, Arial, sans-serif"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            Jump to bottom
          </button>
        )}


      </div>

    </div>
  );
}

export default GChatApp;
