// src/features/GmailApp.jsx
import React, { useState } from "react";
import SmartLink from "../components/SmartLink.jsx";
import { DRAFT_TEMPLATES } from "../utils/appData.js";
import { timeAgo } from "../components/ActivityPane.jsx";
import { EmailMetadata, EmailSignature } from "../components/RightPanel.jsx";

export function GmailApp({
  // --- Computed ---
  filteredEmails,
  combinedContacts,
  // --- State ---
  gmailEmails, setGmailEmails,
  gmailLoading, setGmailLoading,
  gmailError, setGmailError,
  gmailFolder, setGmailFolder,
  gmailRefreshTrigger, setGmailRefreshTrigger,
  gmailPage, setGmailPage,
  gmailTotal, setGmailTotal,
  gmailPageTokens, setGmailPageTokens,
  selectedEmailIds, setSelectedEmailIds,
  hoveredEmailId, setHoveredEmailId,
  email, setEmail,
  emailPreview, setEmailPreview,
  showEmailDetails, setShowEmailDetails,
  selectedDraftTemplate, setSelectedDraftTemplate,
  draftTo, setDraftTo,
  draftAttachments, setDraftAttachments,
  isDraftEnlarged, setIsDraftEnlarged,
  showDraftPicker, setShowDraftPicker,
  searchQuery, setSearchQuery,
  otherContacts, setOtherContacts,
  historyContacts, setHistoryContacts,
  draftPos, setDraftPos,
  currentView, setCurrentView,
  batchStatus,
  setReviewingDoc,
  setIsLiveCallActive,
  setSnackbar,
  // --- Refs ---
  draftFileInputRef,
  draftWindowRef,
  isDraggingDraft,
  htmlTooltipRef,
  // --- Handlers ---
  triggerSnackbar,
}) {
if (currentView.app === "gmail") {
    const allSelected = (filteredEmails || []).length > 0 && selectedEmailIds.size === filteredEmails.length;

    const toggleSelectAll = () => {
      if (allSelected) setSelectedEmailIds(new Set());
      else setSelectedEmailIds(new Set(filteredEmails.map(e => e.id)));
    };

 const handleDeleteSelected = async () => {
      const snapshotIds = Array.from(selectedEmailIds);
      if (snapshotIds.length === 0) return;
      
      const isPerm = gmailFolder === "TRASH";
      const countToRemove = snapshotIds.length;
      
      // 1. OPTIMISTIC COUNT REDUCTION: Subtract from the total immediately
      setGmailTotal(prev => Math.max(0, prev - countToRemove));
      setGmailLoading(true);
      
      try {
        const bulkResponse = await fetch("/.netlify/functions/gmail-delete-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: snapshotIds, permanent: isPerm })
        });

        const bulkResult = await bulkResponse.json().catch(() => ({ ok: bulkResponse.ok }));

        if (bulkResponse.ok && bulkResult.ok) {
          setSelectedEmailIds(new Set());
          setGmailEmails([]); 
          setGmailRefreshTrigger(p => p + 1);
          
          triggerSnackbar(
            isPerm ? `${countToRemove} item(s) permanently deleted.` : `${countToRemove} conversation(s) moved to Trash.`,
            isPerm ? null : { type: "delete", ids: snapshotIds }
          );
          
          // (snackbar above already provides user feedback — no extra sound notification needed)
        } else {
          // Revert count on error
          setGmailTotal(prev => prev + countToRemove);
          setGmailLoading(false);
          alert(`Error: ${bulkResult.error || "Server failed to process request"}`);
        }
      } catch (e) { 
        setGmailTotal(prev => prev + countToRemove);
        console.error("Delete handler error:", e);
        setGmailLoading(false);
        alert("Action failed.");
      }
    };

 const handleMarkUnreadSelected = async () => {
      const snapshotIds = Array.from(selectedEmailIds);
      if (snapshotIds.length === 0) return;
      setGmailLoading(true);
      try {
        setGmailEmails(prev => {
          const markedIds = new Set(snapshotIds);
          const marked = prev.filter(e => markedIds.has(e.id)).map(e => ({ ...e, isUnread: true }));
          const rest = prev.filter(e => !markedIds.has(e.id));
          return [...marked, ...rest];
        });
        const res = await fetch("/.netlify/functions/gmail-mark-unread-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: snapshotIds })
        });
        if (res.ok) {
          setSelectedEmailIds(new Set());
          triggerSnackbar(`${snapshotIds.length} marked as unread.`);
        }
      } catch (e) {
        console.error(e);
      }
      setGmailLoading(false);
    };
    return (
            <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", background: "#fff", borderRadius: "12px", border: "1px solid #8993a4", boxShadow: "0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)", overflow: "hidden" }}>
              
              {/* 🟢 TOP ROW: COMPOSE + SEARCH BAR */}
              <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "16px" }}>
                <button 
                  className="btn blue" 
                  onClick={() => {
                    setEmail(null);
                    setEmailPreview(null);
                    setSelectedDraftTemplate({ ...DRAFT_TEMPLATES.find(t => t.id === "new_blank") });
                    setDraftTo("");
                    setDraftAttachments([]);
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.background = "#c2e7ff";
                    e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.1)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)";
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f8f9fa";
                    e.currentTarget.style.boxShadow = "0 1px 3px 0 rgba(60,64,67,0.30), 0 4px 8px 3px rgba(60,64,67,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)";
                  }}
                  style={{ 
                    borderRadius: "16px", 
                    padding: "10px 24px", 
                    fontSize: "14px", 
                    fontWeight: 500, 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    background: "#fff", /* ⚪ Default light state */
                    color: "#444746",
                    border: "none",
                    boxShadow: "0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)", /* Standard Gmail FAB shadow */
                    flexShrink: 0,
                    transition: "all 0.1s ease"
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                  Compose
                </button>

                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search in mail..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setGmailPage(1);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 44px",
                      borderRadius: "24px",
                      border: "none",
                      fontSize: "15px",
                      outline: "none",
                      background: "#f1f3f4"
                    }}
                  />
                  <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#5f6368" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
              </div>

              {/* 🟢 SECOND ROW: SELECT ALL + NAV PILLS + PAGINATION */}
              <div style={{ padding: "8px 16px", borderBottom: "1px solid #eee", background: "#fff", display: "flex", alignItems: "center", minHeight: "48px", gap: "16px" }}>
                
                {/* 1. Select All Box */}
                <div style={{ display: "flex", alignItems: "center", width: "40px", justifyContent: "center", flexShrink: 0 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: "pointer", width: "18px", height: "18px" }} />
                </div>

                {/* 2. Selection Count & Bulk Actions */}
                {selectedEmailIds.size > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                    <span style={{ fontSize: "14px", color: "#202124", fontWeight: 500 }}>
                      {selectedEmailIds.size} selected
                    </span>
                    
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", borderLeft: "1px solid #dadce0", paddingLeft: "12px" }}>
                      {/* MOVE TO TRASH / PERMANENT DELETE */}
                      <button 
                        onClick={handleDeleteSelected} 
                        title={gmailFolder === "TRASH" ? "Delete permanently" : "Move to Trash"}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", padding: "6px", aspectRatio: "1", borderRadius: "50%", display: "grid", placeItems: "center" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>

                      {/* MARK AS UNREAD */}
                      <button 
                        onClick={handleMarkUnreadSelected} 
                        title="Mark as unread"
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", padding: "6px", aspectRatio: "1", borderRadius: "50%", display: "grid", placeItems: "center" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>
                      </button>

                      {/* RESTORE BUTTON (Only shows in Trash) */}
                      {gmailFolder === "TRASH" && (
                  <button 
                    onClick={async () => {
                      const snapshotIds = Array.from(selectedEmailIds);
                      setGmailLoading(true);
                      try {
                        const res = await fetch("/.netlify/functions/gmail-delete-bulk", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ messageIds: snapshotIds, restore: true })
                        });
                        if (res.ok) {
                          setSelectedEmailIds(new Set());
                          setGmailEmails([]);
                          setGmailRefreshTrigger(p => p + 1);
                          // 🟢 Trigger "Action completed" Snackbar with Undo info
                          triggerSnackbar(
                            `${snapshotIds.length} conversation(s) restored to Inbox.`,
                            { type: "restore", ids: snapshotIds }
                          );
                        }
                      } catch (e) { console.error(e); }
                      setGmailLoading(false);
                    }}
                          title="Restore to Inbox"
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", padding: "6px", aspectRatio: "1", borderRadius: "50%", display: "grid", placeItems: "center" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 3. Navigation Pills Group (Shows when nothing is selected) */
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      onClick={() => { 
                        setGmailEmails([]); 
                        setGmailRefreshTrigger(p => p + 1); 
                        setGmailFolder("INBOX"); 
                        setGmailPage(1); 
                        setSelectedEmailIds(new Set()); 
                      }}
                      style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "INBOX" ? "#c2e7ff" : "transparent", color: gmailFolder === "INBOX" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      {gmailFolder === "INBOX" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.44 2s2.75-.81 3.44-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>}
                      <span>Inbox</span>
                      {gmailFolder === "INBOX" && gmailTotal > 0 && <span style={{ fontSize: "11px", fontWeight: 600, color: "#0b57d0", background: "#d3e3fd", borderRadius: "999px", padding: "1px 7px" }}>{gmailTotal.toLocaleString()}</span>}
                    </button>

                    <button
                      onClick={() => {
                        setGmailEmails([]);
                        setGmailRefreshTrigger(p => p + 1);
                        setGmailFolder("STARRED");
                        setGmailPage(1); 
                        setSelectedEmailIds(new Set()); 
                      }}
                      style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "STARRED" ? "#c2e7ff" : "transparent", color: gmailFolder === "STARRED" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      {gmailFolder === "STARRED" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>}
                      <span>Starred</span>
                      {gmailFolder === "STARRED" && gmailTotal > 0 && <span style={{ fontSize: "11px", fontWeight: 600, color: "#0b57d0", background: "#d3e3fd", borderRadius: "999px", padding: "1px 7px" }}>{gmailTotal.toLocaleString()}</span>}
                    </button>

                    <button
                      onClick={() => { 
                        setGmailEmails([]); 
                        setGmailRefreshTrigger(p => p + 1); 
                        setGmailFolder("SENT"); 
                        setGmailPage(1); 
                        setSelectedEmailIds(new Set()); 
                      }}
                      style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "SENT" ? "#c2e7ff" : "transparent", color: gmailFolder === "SENT" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      {gmailFolder === "SENT" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
                      <span>Sent</span>
                      {gmailFolder === "SENT" && gmailTotal > 0 && <span style={{ fontSize: "11px", fontWeight: 600, color: "#0b57d0", background: "#d3e3fd", borderRadius: "999px", padding: "1px 7px" }}>{gmailTotal.toLocaleString()}</span>}
                    </button>

                    <button
                      onClick={() => { 
                        setGmailEmails([]); 
                        setGmailRefreshTrigger(p => p + 1); 
                        setGmailFolder("DRAFTS"); 
                        setGmailPage(1); 
                        setSelectedEmailIds(new Set()); 
                      }}
                      style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "DRAFTS" ? "#c2e7ff" : "transparent", color: gmailFolder === "DRAFTS" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      {gmailFolder === "DRAFTS" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>}
                      <span>Drafts</span>
                      {gmailFolder === "DRAFTS" && gmailTotal > 0 && <span style={{ fontSize: "11px", fontWeight: 600, color: "#0b57d0", background: "#d3e3fd", borderRadius: "999px", padding: "1px 7px" }}>{gmailTotal.toLocaleString()}</span>}
                    </button>

                    <button
                      onClick={() => { 
                        setGmailEmails([]); 
                        setGmailRefreshTrigger(p => p + 1); 
                        setGmailFolder("TRASH"); 
                        setGmailPage(1); 
                        setSelectedEmailIds(new Set()); 
                      }}
                      style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "TRASH" ? "#c2e7ff" : "transparent", color: gmailFolder === "TRASH" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      {gmailFolder === "TRASH" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>}
                      <span>Trash</span>
                      {gmailFolder === "TRASH" && gmailTotal > 0 && <span style={{ fontSize: "11px", fontWeight: 600, color: "#0b57d0", background: "#d3e3fd", borderRadius: "999px", padding: "1px 7px" }}>{gmailTotal.toLocaleString()}</span>}
                    </button>
                  </div>
                )}

        {/* 4. Reload & Pagination (Pinned to right) */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#5f6368", fontSize: "13px", marginLeft: "auto", marginRight: "4px" }}>
                  
                  {/* 🔄 RELOAD BUTTON */}
                  <button 
                    onClick={() => {
                      setGmailEmails([]); 
                      setGmailRefreshTrigger(p => p + 1); 
                    }}
                    title="Refresh"
                    style={{ 
                      background: "transparent", 
                      border: "none", 
                      cursor: "pointer", 
                      color: "#5f6368", 
                      padding: "6px", 
                      borderRadius: "50%", 
                      display: "grid", 
                      placeItems: "center",
                      transition: "background 0.2s" 
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                  </button>

                {(() => {
    const isSearching = !!searchQuery.trim();
    const hasNextPage = !!gmailPageTokens[gmailPage + 1];
    
    // ⚡ STABLE MATH: Use the page number to lock the range so it never jumps to 0
    const startIndex = (gmailPage - 1) * 50 + 1;
    const visibleCount = filteredEmails.length;
    
    // If we are loading, we assume the page will be full (50), otherwise use actual count
    const endIndex = (gmailLoading || visibleCount === 0) 
        ? (gmailPage * 50) 
        : (startIndex + visibleCount - 1);
    
    let displayTotal = "";

    // ⚡ THE FLICKER SHIELD
    if (isSearching) {
        if (gmailLoading) {
            displayTotal = "many";
        } else if (hasNextPage) {
            displayTotal = "many";
        } else {
            // Priority: Total > Visible Count > End Index
            displayTotal = Math.max(gmailTotal, visibleCount, endIndex).toLocaleString();
        }
    } else {
        // 🛡️ TRASH/FOLDER TOTAL FIX:
        // If gmailTotal is less than what we actually see (e.g., 16 vs 31), force the visible count.
        const safeTotal = Math.max(gmailTotal || 0, visibleCount);
        displayTotal = safeTotal > 0 ? safeTotal.toLocaleString() : (gmailLoading ? "..." : "0");
    }

    // Ensure endIndex does not exceed the actual number of loaded emails on the last page
    const actualEndIndex = gmailLoading ? endIndex : (startIndex + filteredEmails.length - 1);
    
    // Final check: If actualEndIndex is higher than displayTotal, sync them
    const finalDisplayTotal = (parseInt(displayTotal.replace(/,/g, '')) < actualEndIndex) 
        ? actualEndIndex.toLocaleString() 
        : displayTotal;

    const paginationText = filteredEmails.length > 0 
      ? `${startIndex}–${actualEndIndex} of ${finalDisplayTotal}`
      : `0–0 of ${finalDisplayTotal}`;
      
    const isNextDisabled = !hasNextPage;

    return (
      <>
        <span style={{ userSelect: 'none', fontSize: "13px", color: "#5f6368" }}>{paginationText}</span>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button 
            onClick={() => { 
              // ⚡ FORCE LOADING STATE IMMEDIATELY
              setGmailLoading(true); 
              setGmailEmails([]); 
              setGmailPage(p => Math.max(1, p - 1)); 
            }} 
            disabled={gmailPage === 1 || gmailLoading} 
            title="Newer"
            style={{ background: "transparent", border: "none", cursor: (gmailPage === 1 || gmailLoading) ? "default" : "pointer", color: (gmailPage === 1 || gmailLoading) ? "#c1c7d0" : "#5f6368", padding: "4px", aspectRatio: "1", borderRadius: "50%" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button 
            onClick={() => { 
              // ⚡ FORCE LOADING STATE IMMEDIATELY
              setGmailLoading(true);
              setGmailEmails([]); 
              setGmailPage(p => p + 1); 
            }} 
            disabled={isNextDisabled || gmailLoading} 
            title="Older"
            style={{ background: "transparent", border: "none", cursor: (isNextDisabled || gmailLoading) ? "default" : "pointer", color: (isNextDisabled || gmailLoading) ? "#c1c7d0" : "#5f6368", padding: "4px", aspectRatio: "1", borderRadius: "50%" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
        </div>
      </>
    );
})()}
                </div>
              </div>

     {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
          {gmailLoading && <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading inbox...</div>}
          {gmailError && <div style={{ padding: "16px", color: "#ea4335" }}>Error: {gmailError}</div>}
          
          {!gmailLoading && !gmailError && filteredEmails.length === 0 && (
            <div style={{ padding: "16px", color: "#5f6368", textAlign: "center", marginTop: "20px" }}>No matching emails found.</div>
          )}

{!gmailLoading && !gmailError && filteredEmails.map((msg, i) => (
            <div 
              key={msg.id || i}
              style={{ 
                display: "flex",
                padding: "10px 16px",
                borderBottom: "1px solid #f1f3f4",
                cursor: "pointer",
                background: selectedEmailIds.has(msg.id) ? "#e8f0fe" : (msg.isUnread ? "#ffffff" : "#f2f6fc"),
                fontWeight: msg.isUnread ? 700 : 400,
                alignItems: "center",
                gap: "12px",
                fontSize: "14px"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "inset 1px 0 0 #dadce0, inset -1px 0 0 #dadce0, 0 1px 2px 0 rgba(60,64,67,.3)"; setHoveredEmailId(msg.id); }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; setHoveredEmailId(null); }}
              onClick={() => {
                setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isUnread: false } : e));
                if (msg.isUnread) {
                  fetch("/.netlify/functions/gmail-mark-read", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId: msg.id })
                  }).catch(err => console.error("Mark read failed", err));
                }
                const fromParts = msg.from ? msg.from.split("<") : ["Unknown", ""];
                const fromName = fromParts[0].replace(/"/g, '').trim();
                const fromEmail = fromParts[1] ? "<" + fromParts[1] : "";
                const baseEmail = {
                  id: msg.id,
                  messageId: msg.messageId,
                  subject: msg.subject, fromName, fromEmail,
                  to: msg.to, date: msg.date, isStarred: msg.isStarred,
                  labelIds: msg.labelIds || [],
                  snippet: msg.snippet || "",
                  time: new Date(msg.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
                  actions: [{ key: "submit_trello", label: "Submit to Trello" }, { key: "update_tracker", label: "Update AC Tracker" }]
                };

                const processBody = (rawBodyStr, atts) => {
                  const isHtml = /<(html|body|div|p|br|b|strong|i|em|a|span|table|style)[^>]*>/i.test(rawBodyStr || "");
                  let rawBody = rawBodyStr || msg.snippet || "";
                  if (!isHtml && rawBody.split('\n').length < 4) {
                    rawBody = rawBody
                      .replace(/(---------- Forwarded message ---------)/gi, '\n\n$1\n')
                      .replace(/(From:|Date:|Subject:|To:|Cc:)/g, '\n$1')
                      .replace(/(Dear\s+[A-Za-z]+|Hi\s+[A-Za-z]+|Good\s+day)/gi, '\n\n$1\n\n')
                      .replace(/(Kind\s+Regards|Regards|Sincerely|Thank\s+you)/gi, '\n\n$1\n')
                      .replace(/(On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^:]+wrote:)/gi, '\n\n$1\n')
                      .replace(/(>\s*>)/g, '>>')
                      .replace(/(>\s+)/g, '\n$1')
                      .replace(/(\s\d+\.)/g, '\n$1')
                      .replace(/\n{3,}/g, '\n\n')
                      .trim();
                  }
                  return {
                    body: isHtml ? "" : rawBody,
                    bodyHtml: isHtml ? rawBodyStr : "",
                    attachments: (atts || []).map(a => ({
                      ...a,
                      type: a.mimeType.includes("pdf") ? "pdf" : a.mimeType.includes("image") ? "img" : a.mimeType.includes("spreadsheet") || a.mimeType.includes("excel") ? "xls" : "file",
                      url: `/.netlify/functions/gmail-download?messageId=${msg.id}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}`
                    }))
                  };
                };

                if (msg.bodyLoaded) {
                  // Already fetched — show immediately from cache
                  setEmail({ ...baseEmail, ...processBody(msg.body, msg.attachments), bodyLoading: false });
                } else {
                  // Show instantly with snippet, fetch full body in background
                  setEmail({ ...baseEmail, body: "", bodyHtml: "", attachments: [], bodyLoading: true });
                  fetch(`/.netlify/functions/gmail-message?messageId=${msg.id}`)
                    .then(r => r.json())
                    .then(json => {
                      if (!json.ok) return;
                      // Cache body in list state so re-opening is instant
                      setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, body: json.body, attachments: json.attachments, bodyLoaded: true } : e));
                      // Update detail view only if still viewing this email
                      setEmail(prev => {
                        if (!prev || prev.id !== msg.id) return prev;
                        return { ...prev, ...processBody(json.body, json.attachments), bodyLoading: false };
                      });
                    })
                    .catch(err => {
                      console.error("Body fetch failed:", err);
                      setEmail(prev => prev?.id === msg.id ? { ...prev, body: msg.snippet || "", bodyLoading: false } : prev);
                    });
                }

                setEmailPreview(null);
                setShowEmailDetails(false);
                setCurrentView({ app: "email", contact: null });
              }}
            >
              {/* Checkbox Container */}
              <div 
                style={{ padding: "0 4px", display: "flex", alignItems: "center" }}
                onClick={(e) => {
                  e.stopPropagation(); 
                  setSelectedEmailIds(prev => {
                    const next = new Set(prev);
                    if (next.has(msg.id)) next.delete(msg.id);
                    else next.add(msg.id);
                    return next;
                  });
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedEmailIds.has(msg.id)} 
                  readOnly 
                  style={{ cursor: "pointer", width: "16px", height: "16px" }} 
                />
              </div>

              {/* ⭐ STAR ICON CONTAINER */}
<div 
  style={{ 
    cursor: "pointer", 
    fontSize: "20px", 
    display: "grid", 
    placeItems: "center",
    color: msg.isStarred ? "#f2d600" : "#c1c7d0",
    transition: "transform 0.1s ease"
  }}
  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    // ⚡ FIX: Use 'msg' from the .map iterator, not the global 'email' state
    handleToggleStar(e, msg.id, msg.isStarred);
  }}
>
  {msg.isStarred ? "★" : "☆"}
</div>
       {/* Sender Name */}
              <div style={{ width: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#202124" }}>
                {(() => {
                  if (gmailFolder === "SENT" || gmailFolder === "DRAFTS" || (msg.labelIds || []).includes("DRAFT")) {
                    if (!msg.to) return "To: (Unknown)";
                    
                    let rawName = msg.to.split("<")[0].replace(/"/g, '').trim();
                    
                    // If there is no formal name attached, it will just be the email address
                    if (!rawName || rawName.includes("@")) {
                      const emailMatch = msg.to.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
                      const emailAddr = emailMatch ? emailMatch[1].toLowerCase() : msg.to.toLowerCase();
                      
                      // 1. 🛡️ SEARCH DEDUPLICATED DIRECTORY: Professional combinedContacts always wins
                      const directoryHit = Object.entries(combinedContacts).find(([name, email]) => email.toLowerCase() === emailAddr);
                      
                      if (directoryHit) {
                        rawName = directoryHit[0];
                      } else {
                        // 2. Fallback for completely external unknown addresses
                        const prefix = emailAddr.split("@")[0];
                        let parts = prefix.split(/[._]/);
                        if (parts.length === 2) parts = parts.reverse();
                        rawName = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                      }
                    }
                    return `To: ${rawName}`;
                  } else {
                    // For Inbox view, check the directory for the "From" field too
                    const fromEmailMatch = msg.from?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
                    const fromEmail = fromEmailMatch ? fromEmailMatch[1].toLowerCase() : "";
                    const dirFrom = Object.entries(combinedContacts).find(([name, email]) => email.toLowerCase() === fromEmail);
                    
                    return dirFrom ? dirFrom[0] : (msg.from ? msg.from.split("<")[0].replace(/"/g, '').trim() : "(Unknown)");
                  }
                })()}
              </div>
              

             {/* Subject, Snippet, and Attachments */}
 <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
   <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center" }}>
     
     {/* 🏷️ AUTHENTIC GMAIL DRAFT TEXT STYLE */}
{(msg.labelIds || []).includes("DRAFT") && (
  <span style={{ 
    color: "#d93025", 
    fontSize: "14px", 
    fontWeight: "400", 
    marginRight: "4px",
    fontFamily: "'Roboto', Arial, sans-serif" 
  }}>
    Draft
  </span>
)}
     

     <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center" }}>
  
 

  <span style={{ color: "#202124", marginRight: "6px" }}>{msg.subject}</span>
  <span style={{ color: "#5f6368", fontWeight: 400 }}>- {msg.snippet}</span>
</div>
   </div>
                
              {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', overflow: 'hidden', alignItems: 'center' }}>
                    {msg.attachments.slice(0, 3).map(att => {
                      const isPdf = att.mimeType.includes('pdf');
                      const isImg = att.mimeType.includes('image');
                      const isXls = att.mimeType.includes('excel') || att.mimeType.includes('spreadsheet');
                      const isWord = att.mimeType.includes('word') || att.mimeType.includes('document');
                      
                      const iconColor = isPdf ? '#ea4335' : isImg ? '#a142f4' : isXls ? '#188038' : isWord ? '#1a73e8' : '#5f6368';
                      const iconBg = isPdf ? '#fce8e6' : isImg ? '#f3e8fd' : isXls ? '#e6f4ea' : isWord ? '#e8f0fe' : '#f1f3f4';
                      const iconText = isPdf ? 'PDF' : isImg ? 'IMG' : isXls ? 'XLS' : isWord ? 'W' : 'FILE';
                      
                      return (
                        <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid #dadce0', borderRadius: '100px', fontSize: '12px', background: '#fff', maxWidth: '180px' }}>
                          <div style={{ background: iconBg, color: iconColor, borderRadius: '4px', padding: '2px 4px', fontSize: '9px', fontWeight: 'bold', display: 'grid', placeItems: 'center', minWidth: '22px' }}>
                            {iconText}
                          </div>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#3c4043', fontWeight: 500 }}>{att.name}</span>
                        </div>
                      )
                    })}
                    {msg.attachments.length > 3 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 10px', border: '1px solid #dadce0', borderRadius: '100px', fontSize: '12px', background: '#fff', color: '#5f6368', fontWeight: 500 }}>
                        +{msg.attachments.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>

              
{/* Date / Hover Actions */}
              {hoveredEmailId === msg.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {/* Mark as unread */}
                  <button
                    title="Mark as unread"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setGmailEmails(prev => {
                        const target = prev.find(x => x.id === msg.id);
                        if (!target) return prev;
                        const rest = prev.filter(x => x.id !== msg.id);
                        return [{ ...target, isUnread: true }, ...rest];
                      });
                      try {
                        await fetch("/.netlify/functions/gmail-mark-unread", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ messageId: msg.id })
                        });
                      } catch (err) { console.error("Mark unread failed", err); }
                    }}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", padding: "4px", borderRadius: "50%", display: "grid", placeItems: "center" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#e8eaed"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>
                  </button>
                  {/* Delete */}
                  <button
                    title={gmailFolder === "TRASH" ? "Delete permanently" : "Move to Trash"}
                    onClick={async (e) => {
                      e.stopPropagation();
                      handleDeleteEmail(msg.id);
                    }}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", padding: "4px", borderRadius: "50%", display: "grid", placeItems: "center" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#e8eaed"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>
                </div>
              ) : (
                <div style={{ width: "80px", textAlign: "right", fontSize: "12px", color: msg.isUnread ? "#1a73e8" : "#5f6368", flexShrink: 0 }}>
                  {msg.date ? (() => {
                    const d = new Date(msg.date);
                    const now = new Date();
                    const isToday = d.getDate() === now.getDate() &&
                                    d.getMonth() === now.getMonth() &&
                                    d.getFullYear() === now.getFullYear();
                    return isToday
                      ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                  })() : ""}
                </div>
              )}
            </div>
          ))}
        </div>

{/* 🔽 COMPOSE EDITOR (Floating over Inbox) 🔽 */}
        {selectedDraftTemplate && !email && (
          <div 
            ref={draftWindowRef}
            style={{
            position: "absolute", 
            bottom: "0", 
            right: "24px",
            zIndex: 1000, 
            border: "1px solid #dadce0", 
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            background: "#fff", 
            borderTopLeftRadius: "12px", 
            borderTopRightRadius: "12px", 
            display: "flex", 
            flexDirection: "column", 
            overflow: "hidden",
            width: isDraftEnlarged ? "calc(100% - 48px)" : "500px",
            height: isDraftEnlarged ? "calc(100% - 48px)" : "560px", /* Fixed height stops it from floating too high */
            transform: isDraftEnlarged ? "none" : `translate(${draftPos.x}px, ${draftPos.y}px)`,
            transition: "width 0.15s ease-out, height 0.15s ease-out" /* Smooth size animations, no transform transitions to prevent drag lag */
          }}>
            {/* Draggable Header */}
            <div 
              style={{ padding: "10px 16px", background: "#f2f6fc", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: isDraftEnlarged ? "default" : "move", userSelect: "none" }}
              onMouseDown={handleDraftMouseDown}
            >
              <span style={{ fontWeight: 600, color: "#1f1f1f", fontSize: "14px" }}>New Message</span>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button 
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setIsDraftEnlarged(prev => !prev); 
                    setDraftPos({x:0, y:0}); 
                    if (draftWindowRef.current) draftWindowRef.current.style.transform = "none";
                  }} 
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5f6368", display: "flex", alignItems: "center" }} 
                  title={isDraftEnlarged ? "Minimize" : "Maximize"}
                >
                  {isDraftEnlarged ? (
                    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                  )}
                </button>
            <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  
                  // 🟢 AUTO-SAVE DRAFT LOGIC
                  const currentSubject = document.getElementById("compose-subject")?.value || "";
                  const bodyText = selectedDraftTemplate?.body || "";
                  const draftIdToDelete = selectedDraftTemplate?.draftId;

                  // Only save to backend if the user actually typed something
                  if (draftTo.trim() || currentSubject.trim() || bodyText.trim()) {
                     triggerSnackbar("Draft saved");
                     
                     // Fire and forget background save (0ms UI latency)
                     fetch("/.netlify/functions/gmail-save-draft", {
                       method: "POST",
                       headers: { "Content-Type": "application/json" },
                       body: JSON.stringify({ 
                         to: draftTo, 
                         subject: currentSubject || "New Message", 
                         body: bodyText.replace(/\*([^*]+)\*/g, "<b>$1</b>")
                       })
                     }).then(res => res.json()).then(json => {
                       if (res.ok && json.ok) {
                         // Clean up the old draft version if we were editing an existing one
                         if (draftIdToDelete) {
                            fetch("/.netlify/functions/gmail-delete", {
                               method: "POST",
                               headers: { "Content-Type": "application/json" },
                               body: JSON.stringify({ messageId: draftIdToDelete })
                            });
                         }
                         if (gmailFolder === "DRAFTS") {
                            setGmailRefreshTrigger(prev => prev + 1);
                         }
                       }
                     }).catch(err => console.error("Auto-save failed", err));
                  }

                  // Close UI instantly
                  setSelectedDraftTemplate(null); 
                  setDraftPos({x:0, y:0}); 
                  setDraftAttachments([]); 
                  setDraftTo("");
                }} 
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "16px", color: "#5f6368", padding: "0 4px" }}
                title="Save & Close"
              >
                ✕
              </button>
              </div>
            </div>
            
         {/* To Field with Suggestions */}
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #f1f3f4", display: "flex", alignItems: "center", position: "relative" }}>
              <span style={{ color: "#5f6368", fontSize: "14px", width: "40px" }}>To</span>
              {selectedDraftTemplate.draftId ? (
                <span style={{ flex: 1, fontSize: "14px", color: "#202124", fontWeight: 500 }}>{draftTo || "(No recipient)"}</span>
              ) : (
                <>
                  <input
                    type="text"
                    autoFocus
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "#202124" }}
                  />
                  
                {/* Suggestion Dropdown */}
                  {(draftTo || "").length > 1 && !(draftTo || "").includes("@") && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: "56px",
                      right: "16px",
                      background: "white",
                      border: "1px solid #dadce0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 2000,
                      maxHeight: "200px",
                      overflowY: "auto",
                      borderRadius: "4px"
                    }}>
                      {Object.entries(combinedContacts)
                        .filter(([name]) => name.toLowerCase().includes((draftTo || "").toLowerCase()))
                        .map(([name, email]) => (
                              <div 
                                key={email}
                                onClick={() => setDraftTo(email)}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f3f4"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                style={{
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "13px",
                                  color: "#202124"
                                }}
                              >
                               <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>
                                <span style={{ color: "#5f6368", marginLeft: "15px", whiteSpace: "nowrap" }}>{email}</span>
                              </div>
                            ))
                          }
                        </div>
                      )}
                </>
              )}
            </div>

{/* Subject Field */}
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #f1f3f4", display: "flex", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Subject"
                defaultValue={selectedDraftTemplate?.subject || ""}
                id="compose-subject"
                style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "#202124", fontWeight: 500 }}
              />
            </div>

            {/* ATTACHMENT PREVIEW ROW */}
            {draftAttachments.length > 0 && (
              <div style={{ padding: "8px 16px", borderBottom: "1px solid #f1f3f4", display: "flex", gap: "8px", flexWrap: "wrap", background: "#f8f9fa" }}>
                {draftAttachments.map((file, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #dadce0", borderRadius: "16px", padding: "4px 10px", fontSize: "12px", color: "#3c4043" }}>
                    <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                    <span style={{ color: "#5f6368" }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                    <button 
                      onClick={() => setDraftAttachments(prev => prev.filter((_, i) => i !== idx))} 
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 2px", color: "#5f6368", display: "flex", alignItems: "center" }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

        {/* Body Container */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", overflowY: "auto" }}>
                    {/* Standard Textarea for Input */}
                    <textarea
                      autoFocus
                      className="email-draft-textarea"
                      value={selectedDraftTemplate.body || ""}
                      onChange={(e) => setSelectedDraftTemplate((prev) => prev ? { ...prev, body: e.target.value } : prev)}
                      style={{ 
                        width: '100%',
                        border: "none", 
                        padding: "16px", 
                        resize: "none", 
                        outline: "none", 
                        minHeight: "200px", 
                        fontSize: "14px", 
                        fontFamily: "Verdana, sans-serif",
                        background: "transparent",
                        color: "#202124", 
                        whiteSpace: "pre-wrap",
                        overflowY: "visible", 
                        boxSizing: "border-box",
                        lineHeight: "1.5",
                        flexShrink: 0
                      }}
                    />
                    {/* Re-inserting the Signature into the preview */}
                    <div style={{ borderTop: "1px solid #f1f3f4", marginTop: "8px", paddingTop: "16px" }}>
                      <EmailSignature />
                    </div>
                </div>
            
        {/* Footer */}
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  className="btn blue"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    if (!draftTo.trim()) {
                      setEmail((prev) => prev ? { ...prev, systemNote: "Please add a recipient address." } : prev);
                      return;
                    }
                    btn.disabled = true;
                    try {
                      const base64Attachments = await Promise.all(draftAttachments.map(file => {
                        return new Promise((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve({
                            filename: file.name,
                            mimeType: file.type || "application/octet-stream",
                            content: reader.result.split(',')[1]
                          });
                          reader.readAsDataURL(file);
                        });
                      }));

                const res = await fetch("/.netlify/functions/gmail-send-email", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            to: draftTo,
                            subject: document.getElementById("compose-subject")?.value || "New Message",
                            body: selectedDraftTemplate.body.replace(/\*([^*]+)\*/g, "<b>$1</b>"),
                            attachments: base64Attachments 
                          }),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
                        
                        // 🟢 IF EDITING A DRAFT, DELETE THE OLD ONE AFTER SENDING
                        if (selectedDraftTemplate.draftId) {
                           fetch("/.netlify/functions/gmail-delete", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ messageId: selectedDraftTemplate.draftId })
                           });
                           setGmailEmails(prev => prev.filter(emailItem => emailItem.id !== selectedDraftTemplate.draftId));
                        }

                        setSelectedDraftTemplate(null);
                        setDraftTo("");
                        setDraftAttachments([]);
                      // 🔽 Show snackbar for 4 seconds
                        triggerSnackbar("Message sent");
                      } catch (err) {
                        setEmail((prev) => prev ? { ...prev, systemNote: `Error: ${err.message}` } : prev);
                        btn.disabled = false;
                      }
                  }}
                  style={{ background: "#0b57d0", color: "#fff", padding: "8px 24px", borderRadius: "24px", border: "none", fontWeight: 500, cursor: "pointer" }}
                >
                  Send
                </button>



                <button 
                  onClick={() => draftFileInputRef.current?.click()} 
                  title="Attach files"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", display: "grid", placeItems: "center", padding: "8px", aspectRatio: "1", borderRadius: "50%" }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = "#f1f3f4"}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-3.31-2.69-6-6-6S3 1.69 3 5v11.5c0 3.86 3.14 7 7 7s7-3.14 7-7V6h-1.5z"/></svg>
                </button>
                <input 
                  type="file" 
                  multiple 
                  ref={draftFileInputRef} 
                  style={{ display: "none" }} 
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const validFiles = files.filter(f => f.size <= 4.5 * 1024 * 1024);
                    if (validFiles.length < files.length) alert("Some files were skipped because they exceed the 4.5MB limit.");
                    setDraftAttachments(prev => [...prev, ...validFiles]);
                    e.target.value = "";
                  }} 
                />
              </div>

           <button 
                title="Discard draft"
                onClick={() => { 
                  // If we were editing an existing draft, delete it from the server
                  if (selectedDraftTemplate?.draftId) {
                    fetch("/.netlify/functions/gmail-delete", {
                       method: "POST",
                       headers: { "Content-Type": "application/json" },
                       body: JSON.stringify({ messageId: selectedDraftTemplate.draftId })
                    }).then(() => {
                       if (gmailFolder === "DRAFTS") setGmailRefreshTrigger(prev => prev + 1);
                    });
                  }
                  
                  // Clear UI instantly
                  setSelectedDraftTemplate(null); 
                  setDraftTo(""); 
                  setDraftAttachments([]); 
                  triggerSnackbar("Draft discarded");
                }} 
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5f6368", padding: "8px", aspectRatio: "1", borderRadius: "50%" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zM9 8h2v9H9zm4 0h2v9h-2z"/></svg>
              </button>
            </div>
          </div>
        )}

   </div>
    );
  }

  if (currentView.app === "email") {
      const att = (email && email.attachments) || [];
      const actions = (email && email.actions) || [];
    

  const handleDeleteEmail = async (id) => {
        if (!window.confirm("Delete this message?")) return;
        try {
          await fetch("/.netlify/functions/gmail-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: id })
          });
          setGmailEmails(prev => prev.filter(e => e.id !== id));
          setCurrentView({ app: "gmail", contact: null });
        } catch (err) {
          console.error("Delete failed", err);
        }
      };
      const handleToggleStar = async (e, msgId, currentStarred) => {
    if (e) {
      e.stopPropagation(); 
      e.preventDefault();  
    }
    
    const nextStarredState = !currentStarred;

    // 1. Update the main list immediately
    setGmailEmails(prev => prev.map(msg => 
      msg.id === msgId ? { ...msg, isStarred: nextStarredState } : msg
    ));

    // 2. Update the individual email view immediately
    setEmail(prev => {
      if (prev && prev.id === msgId) {
        return { ...prev, isStarred: nextStarredState };
      }
      return prev;
    });

    try {
      const response = await fetch("/.netlify/functions/gmail-toggle-star", {
        method: "POST",
        credentials: "include", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msgId, starred: nextStarredState })
      });

      // If the request fails, the catch block will handle the revert
      if (!response.ok) throw new Error("Sync failed");

      if (!nextStarredState && gmailFolder === "STARRED") {
        setGmailEmails(prev => prev.filter(msg => msg.id !== msgId));
      }
    } catch (err) {
      console.error("Starring sync failed:", err);
      // Revert both states on failure
      setGmailEmails(prev => prev.map(msg => 
        msg.id === msgId ? { ...msg, isStarred: currentStarred } : msg
      ));
      setEmail(prev => (prev && prev.id === msgId) ? { ...prev, isStarred: currentStarred } : prev);
    }
  };

const emailPane = (
  <div className="email-pane" style={{ border: "1px solid #e6e6e6", borderRadius: "12px", boxSizing: "border-box", padding: "0 24px", background: "#fff", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      
      {/* ❄️ FROZEN HEADER: strictly limited to the Action Bar buttons */}
      <div style={{ 
        background: "#fff", 
        padding: "8px 0",
        borderBottom: "1px solid #f1f3f4",
        flexShrink: 0,
        zIndex: 10
      }}>
        {/* Top Gmail Action Bar */}
        <div className="gmail-action-bar" style={{ padding: "0", borderBottom: "none" }}>
          <div className="gmail-action-icon" onClick={() => setCurrentView({ app: "gmail", contact: null })} title="Back to inbox">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </div>
          <div className="gmail-action-icon" onClick={() => handleDeleteEmail(email.id)} title="Delete">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </div>
          <div className="gmail-action-icon" title="Mark as unread" onClick={async () => {
             setGmailEmails(prev => {
               const target = prev.find(e => e.id === email.id);
               if (!target) return prev;
               const rest = prev.filter(e => e.id !== email.id);
               return [{ ...target, isUnread: true }, ...rest];
             });
             setCurrentView({ app: "gmail", contact: null });
             try {
               await fetch("/.netlify/functions/gmail-mark-unread", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ messageId: email.id })
               });
             } catch (err) { console.error("Failed to mark unread", err); }
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>
          </div>
        </div>
      </div>

      {/* 📜 SCROLLABLE CONTENT WITH GREY BORDER */}
      <div style={{ flex: 1, overflowY: "auto", border: "1px solid #dadce0", borderRadius: "12px", margin: "16px 0 24px 0", paddingBottom: "24px", background: "#fff" }}>
        
        {/* Subject Line Row (Now correctly at the top of the scrollable body) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 24px 8px 24px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 400, color: "#1f1f1f", margin: 0, display: "flex", alignItems: "center", gap: "12px", fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
                {email.subject}
                <span style={{ fontSize: "12px", background: "#f1f3f4", padding: "2px 6px", borderRadius: "4px", color: "#5f6368", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Inbox
                </span>
              </h2>
            </div>

            {/* Sender Info Row */}
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: "16px", padding: "0 24px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#5c6bc0", color: "white", display: "grid", placeItems: "center", fontSize: "18px", marginRight: "16px", flexShrink: 0 }}>
                {email.fromName ? email.fromName.charAt(0).toUpperCase() : "U"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    <span style={{ fontWeight: 600, color: "#202124", fontSize: "14px" }}>{email.fromName}</span>
                    <span style={{ color: "#5f6368", fontSize: "12px" }}>{email.fromEmail}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#5f6368", fontSize: "12px", flexShrink: 0 }}>
                    <span>{email.time} ({timeAgo(email.date)})</span>
                    
                    {/* ⭐ STAR BUTTON */}
                    <div 
                      style={{ 
                        cursor: "pointer", 
                        fontSize: "20px", 
                        display: "grid", 
                        placeItems: "center",
                        color: email.isStarred ? "#f2d600" : "#c1c7d0",
                        transition: "transform 0.1s ease"
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleStar(e, email.id, email.isStarred);
                      }}
                    >
                      {email.isStarred ? "★" : "☆"}
                    </div>
                    <div 
                      style={{ cursor: "pointer", display: "grid", placeItems: "center" }}
                      onClick={() => {
                        const replyTpl = DRAFT_TEMPLATES.find(t => t.id === "new_blank");
                        setSelectedDraftTemplate({...replyTpl, body: "\n\n", isForward: false});
                        let targetEmail = email.fromEmail ? email.fromEmail.replace("<", "").replace(">", "").trim() : "";
                        setDraftTo(targetEmail);
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                    </div>
                  </div>
                </div>
                
                {/* 🔽 INTERACTIVE "TO ME" POPOVER */}
                <EmailMetadata email={email} />
              </div>
            </div>

          {/* Email Body */}
          <div 
            className="email-body" 
            style={{ marginLeft: "56px", marginTop: "24px", paddingRight: "48px", paddingBottom: "60px", position: "relative" }}
            onClick={(e) => {
              if (htmlTooltipRef.current) {
                htmlTooltipRef.current.style.opacity = "0"; // 👈 GUARANTEED FIX: Hides the plain-text tooltip immediately
              }
              const anchor = e.target.closest("a");
              if (anchor && anchor.href && anchor.href.includes("meet.google.com")) {
                setIsLiveCallActive(true);
                window.dispatchEvent(new CustomEvent("googleMeetLaunched"));
              }
            }}
            // ⚡ 0ms LATENCY: Direct DOM manipulation via Ref
            onMouseOver={(e) => {
              const anchor = e.target.closest("a");
              if (anchor && anchor.href && /docs\.google\.com|sheets\.google\.com|meet\.google\.com/.test(anchor.href)) {
                const containerRect = e.currentTarget.getBoundingClientRect();
                const linkRect = anchor.getBoundingClientRect();
                
                if (htmlTooltipRef.current) {
                  htmlTooltipRef.current.style.top = `${linkRect.top - containerRect.top - 8}px`;
                  htmlTooltipRef.current.style.left = `${linkRect.left - containerRect.left + (linkRect.width / 2)}px`;
                  htmlTooltipRef.current.style.opacity = "1";
                }
              }
            }}
            onMouseOut={(e) => {
              if (e.target.closest("a") && htmlTooltipRef.current) {
                htmlTooltipRef.current.style.opacity = "0";
              }
            }}
          >
            {/* ⚡ THE TOOLTIP: Always rendered, but hidden by default via opacity: 0 */}
            <div 
              ref={htmlTooltipRef}
              style={{
                position: "absolute",
                opacity: 0, // <--- Hidden by default
                transform: "translate(-50%, -100%)",
                backgroundColor: "#f1f3f4",
                color: "#202124",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                zIndex: 999999,
                boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                pointerEvents: "none",
                fontFamily: "system-ui, -apple-system, sans-serif",
                transition: "opacity 0.1s ease-out" // Smooth, instant fade
              }}
            >
              Right-click for more options...
              {/* Tooltip Triangle */}
              <div style={{
                content: '""',
                position: "absolute",
                top: "100%",
                left: "50%",
                marginLeft: "-6px",
                borderWidth: "6px",
                borderStyle: "solid",
                borderColor: "#f1f3f4 transparent transparent transparent"
              }} />
            </div>

            {email.bodyLoading ? (
              <div style={{ color: "#9aa0a6", fontSize: "14px", padding: "8px 0" }}>Loading…</div>
            ) : email.bodyHtml ? (
              <div
                className="email-body-html"
                style={{ fontFamily: "'Google Sans', Roboto, Arial, sans-serif", fontSize: "14px", color: "#202124", lineHeight: "1.6" }}
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <div className="email-body-text" style={{ fontFamily: "Roboto, Arial, sans-serif", fontSize: "14px", color: "#202124", wordBreak: "break-word" }}>
                {(() => {
                  const body = email.body || "";
                  
                  const renderTextWithLinks = (textStr) => {
                    return textStr.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
                      if (part.match(/^https?:\/\//)) {
                        return (
                          <SmartLink
                            key={i}
                            url={part}
                            setIsLiveCallActive={setIsLiveCallActive}
                            style={{ color: "#1a73e8", textDecoration: "underline", wordBreak: "break-all" }}
                          >
                            {part}
                          </SmartLink>
                        );
                      }
                      return <React.Fragment key={i}>{part}</React.Fragment>;
                    });
                  };

                  const renderFormattedBody = (text, depth = 0) => {
                    const forwardRegex = /[-]{3,}\s*Forwarded message\s*[-]{3,}/i;
                    const replyRegex = /(^On\s.+\sat\s.+\s.+\swrote:)/im;

                    if (forwardRegex.test(text)) {
                      const parts = text.split(forwardRegex);
                      return (
                        <>
                          {parts[0] && (
                            <div className="gmail-paragraph-wrapper">
                              {parts[0].trim().split('\n').map((line, i) => (
                                <div key={i} style={{ marginBottom: line.trim() ? "14px" : "8px", minHeight: line.trim() ? "auto" : "12px" }}>{renderTextWithLinks(line)}</div>
                              ))}
                            </div>
                          )}
                          {parts.slice(1).map((segment, idx) => (
                            <div key={idx} className="gmail-forward-wrap" style={{ marginTop: "28px", paddingLeft: depth > 0 ? "12px" : "0", borderLeft: depth > 0 ? "1px solid #dadce0" : "none" }}>
                              <div style={{ color: "#5f6368", fontSize: "13px", marginBottom: "16px", fontStyle: "normal" }}>
                                ---------- Forwarded message ---------
                              </div>
                              {renderFormattedBody(segment.trim(), depth + 1)}
                            </div>
                          ))}
                        </>
                      );
                    }

                    if (replyRegex.test(text)) {
                      const parts = text.split(replyRegex);
                      return (
                        <>
                          {parts[0] && <div>{renderTextWithLinks(parts[0].trim())}</div>}
                          <div className="gmail-reply-quote" style={{ borderLeft: "2px solid #72a8ff", paddingLeft: "16px", color: "#505050", marginTop: "16px" }}>
                            <div style={{ fontWeight: "500", marginBottom: "12px", color: "#5f6368" }}>{parts[1]}</div>
                            {parts.slice(2).join("").split('\n').map((line, i) => (
                              <div key={i} style={{ marginBottom: "12px" }}>{renderTextWithLinks(line)}</div>
                            ))}
                          </div>
                        </>
                      );
                    }

                    // Fallback for standard text: Use pre-wrap to respect original formatting
                  return (
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                      {renderTextWithLinks(text)}
                    </div>
                  );
                  };

                  return renderFormattedBody(body);
                })()}
              </div>
            )}
          </div>

         {/* Attachments Section */}
          {att.length > 0 && (
            <div style={{ marginLeft: "56px", marginTop: "24px" }}>
              <div style={{ borderTop: "1px solid #f1f3f4", margin: "16px 0", width: "100%" }}></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#202124' }}>{att.length} attachment{att.length > 1 ? 's' : ''}</span>
                <span style={{ color: '#5f6368', fontSize: '13px' }}>· Scanned by Gmail ⓘ</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                  <button 
                    onClick={() => {
                      att.forEach((a, index) => {
                        setTimeout(() => {
                          const link = document.createElement('a');
                          link.href = a.url;
                          link.setAttribute('download', a.name);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }, index * 600);
                      });
                    }}
                    title="Download all"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368', padding: '8px', borderRadius: '50%' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  </button>
                </div>
              </div>

             <div className="email-attach-grid">
                {att.map((f, i) => {
                  const isPdf = f.type === 'pdf' || f.name.toLowerCase().includes('.pdf');
                  const isImg = f.type === 'img' || f.name.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/i);
                  const isXls = f.type === 'xls' || f.name.toLowerCase().match(/\.(xls|xlsx|csv)$/i);
                  const isWord = f.type === 'doc' || f.name.toLowerCase().match(/\.(doc|docx)$/i);
                  
                  const iconColor = isPdf ? '#ea4335' : isImg ? '#a142f4' : isXls ? '#188038' : isWord ? '#1a73e8' : '#5f6368';
                  const displayType = isPdf ? 'PDF' : isImg ? 'IMG' : isXls ? 'XLS' : isWord ? 'DOC' : 'FILE';

                  // 🧠 Extraction Logic for this specific file
                  const fileData = batchStatus?.fileResults?.find(res => res.fileName === f.name);
                  const foundDocs = fileData?.foundDocs || []; // e.g. ["2 payslips", "1 IP"]
                  const fileStatus = fileData?.status || "Extracting..."; // Extracting, Extraction Complete, Approved
                  const isActionable = fileStatus === "Extraction Complete" || fileStatus === "Approved";

                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '180px' }}>
                      <button
                        className="email-attach"
                        onClick={(e) => {
                          e.stopPropagation();
                          const isViewable = f.type === 'pdf' || f.type === 'img';
                          if (isViewable) {
                            setEmailPreview(f);
                          } else {
                            const link = document.createElement("a");
                            link.href = f.url;
                            link.setAttribute("download", f.name);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        title={f.name}
                        style={{ background: "#fff", border: "1px solid #dadce0", borderRadius: "8px", width: "100%", height: "auto", padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}
                      >
                        <div className="email-attach-preview" style={{ height: "100px", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: "28px", fontWeight: "bold", color: iconColor, opacity: 0.3 }}>
                            {displayType}
                          </div>
                        </div>
                        <div className="email-attach-footer" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderTop: "1px solid #dadce0", width: "100%" }}>
                          <span style={{ background: iconColor, color: "white", padding: "2px 4px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
                            {displayType}
                          </span>
                          <span className="email-attach-name" style={{ fontSize: "12px", color: "#3c4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                        </div>
                      </button>

                      {/* 📄 EXTRACTION TEXT OVERLAY (Under each file) */}
                      {(isPdf || isImg) && (
                        <div style={{ padding: "0 4px", fontSize: "12px", lineHeight: "1.4" }}>
                          {foundDocs.length > 0 ? (
                            <>
                              {foundDocs.map((docText, dIdx) => (
                                <div key={dIdx} style={{ color: "#1f1f1f", fontWeight: 500 }}>{docText}</div>
                              ))}
                              <div 
                                onClick={() => isActionable && setReviewingDoc({ label: f.name, status: fileStatus })}
                                style={{ 
                                  marginTop: "4px", 
                                  fontWeight: 700, 
                                  color: fileStatus === "Approved" ? "#188038" : "#0b57d0", 
                                  cursor: isActionable ? "pointer" : "default",
                                  textDecoration: fileStatus === "Extraction Complete" ? "underline" : "none"
                                }}
                              >
                                {fileStatus}.
                              </div>
                            </>
                          ) : (
                            <div style={{ color: "#5f6368", fontStyle: "italic" }}>
                              {batchStatus ? "No relevant docs found." : "Waiting for AI..."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 🟢 CONDENSED BATCH SUBMIT (Only if all relevant files are Approved) */}
              {(() => {
                if (!batchStatus || !batchStatus.fileResults) return null;
                
                const relevantFiles = batchStatus.fileResults.filter(f => f.foundDocs && f.foundDocs.length > 0);
                const allApproved = relevantFiles.length > 0 && relevantFiles.every(f => f.status === "Approved");

                if (!allApproved) return null;

                return (
                  <div style={{ marginTop: "32px", textAlign: "center", width: "100%", paddingBottom: "24px" }}>
                    <button 
                      className="btn green"
                      onClick={async () => {
                        triggerSnackbar("Generating export...");
                        try {
                          const res = await fetch("/.netlify/functions/excel-export", {
                            method: "POST",
                            body: JSON.stringify({ batchId: batchStatus.batchId })
                          });
                          const json = await res.json();
                          
                          if (json.ok && json.rows) {
                            const headers = "Category,Field,Value\n";
                            const csvContent = json.rows.map(r => `"${r.Category}","${r.Field}","${String(r.Value).replace(/"/g, '""')}"`).join("\n");
                            const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.setAttribute("href", url);
                            link.setAttribute("download", json.filename);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            triggerSnackbar("Excel file downloaded!");
                          }
                        } catch (e) {
                          console.error(e);
                          alert("Export failed.");
                        }
                      }}
                      style={{ 
                        background: "#188038", color: "white", padding: "12px 48px", 
                        borderRadius: "24px", fontWeight: 700, fontSize: "15px", 
                        border: "none", boxShadow: "0 4px 12px rgba(24,128,56,0.3)",
                        cursor: "pointer"
                      }}
                    >
                      Submit to Excel
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
{/* Authentic Gmail Inline Reply Trigger & Actions */}
          {!selectedDraftTemplate && (
            <div style={{ marginLeft: "56px", marginTop: "32px", paddingBottom: "24px" }}>
              
       {/* Reply, Forward, or Edit Draft */}
<div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
  {/* ⚡ BROADENED LOGIC: Check for DRAFT label to show Edit Draft button in Inbox/Search results */}
  {((email.labelIds || []).includes("DRAFT") || gmailFolder === "DRAFTS") ? (
    <button 
      className="gmail-btn-outline" 
      onClick={() => {
        const rawText = email.bodyHtml || email.body || "";
        let plainBody = email.bodyHtml ? rawText.replace(/<br\s*[\/]?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "") : rawText;
        
        const sigIndex = plainBody.indexOf("Kind regards");
        if (sigIndex !== -1) {
          plainBody = plainBody.substring(0, sigIndex).trim();
        }

        let toEmail = "";
        if (email.to && email.to.length > 0) {
           const toStr = Array.isArray(email.to) ? email.to[0] : email.to;
           const emailMatch = (typeof toStr === "string" ? toStr : "").match(/<([^>]+)>/);
           toEmail = emailMatch ? emailMatch[1].trim() : (typeof toStr === "string" ? toStr.replace(/"/g, '').trim() : "");
        }

        setSelectedDraftTemplate({
          id: "existing_draft",
          draftId: email.id,
          label: "Edit Draft",
          subject: email.subject || "",
          body: plainBody + "\n\n",
          isForward: false 
        });
        setDraftTo(toEmail);

        if (email.attachments && email.attachments.length > 0) {
          Promise.all(email.attachments.map(async (a) => {
            const res = await fetch(a.url);
            const blob = await res.blob();
            return new File([blob], a.name, { type: a.mimeType });
          })).then(files => setDraftAttachments(files));
        }

        setEmail(null);
        setEmailPreview(null);
        setCurrentView({ app: "gmail", contact: null });
      }}
      style={{ borderRadius: "100px", padding: "8px 24px", color: "#3c4043", border: "1px solid #dadce0", display: "flex", alignItems: "center", gap: "8px", background: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      Edit Draft
    </button>
  ) : (
    <>
      <button 
        className="gmail-btn-outline" 
        onClick={() => {
          const replyTpl = DRAFT_TEMPLATES.find(t => t.id === "new_blank");
          setSelectedDraftTemplate({...replyTpl, body: "\n\n", isForward: false});
          let targetEmail = email.fromEmail ? email.fromEmail.replace("<", "").replace(">", "").trim() : "";
          setDraftTo(targetEmail);
        }}
        style={{ borderRadius: "100px", padding: "8px 24px", color: "#3c4043", border: "1px solid #dadce0", display: "flex", alignItems: "center", gap: "8px", background: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
        Reply
      </button>
      <button 
        className="gmail-btn-outline" 
        onClick={async () => {
          const replyTpl = DRAFT_TEMPLATES.find(t => t.id === "new_blank");
          const cleanFromEmail = email.fromEmail ? email.fromEmail.replace(/[<>]/g, '') : "";
          const fromLine = email.fromName && !email.fromName.includes("@") ? `${email.fromName} <${cleanFromEmail}>` : `<${cleanFromEmail || email.fromName}>`;
          const fwdHeader = `\n\n---------- Forwarded message ---------\nFrom: ${fromLine}\nDate: ${email.time}\nSubject: ${email.subject}\nTo: Siyabonga Nono <siyabonga@actuaryconsulting.co.za>\n\n`;
          const fwdBody = email.body || email.snippet || "";
          
          if (email.attachments && email.attachments.length > 0) {
            try {
              const existingFiles = await Promise.all(email.attachments.map(async (a) => {
                const res = await fetch(a.url);
                const blob = await res.blob();
                return new File([blob], a.name, { type: a.mimeType });
              }));
              setDraftAttachments(existingFiles);
            } catch (e) { console.error(e); }
          }
          setSelectedDraftTemplate({...replyTpl, body: fwdHeader + fwdBody, isForward: true});
          setDraftTo(""); 
        }}
        style={{ borderRadius: "100px", padding: "8px 24px", color: "#3c4043", border: "1px solid #dadce0", display: "flex", alignItems: "center", gap: "8px", background: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>
        Forward
      </button>
    </>
  )}
</div>

              {/* Trello / Tracker Actions (Hidden for Drafts) */}
              {gmailFolder !== "DRAFTS" && (
                <div className="email-actions" style={{ borderTop: "1px solid #f1f3f4", paddingTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-start" }}>
                  {actions.map((a) => (
                    <button
                      key={a.key}
                      className="email-action-btn"
                      onClick={() => handleEmailAction(a.key)}
                    >
                      {a.label}
                    </button>
                  ))}
                  <button
                    className="email-action-btn"
                    onClick={() => setShowDraftPicker(prev => !prev)}
                  >
                    Create Draft
                  </button>
                </div>
              )}

              {email.systemNote && (
                <div className="email-note" style={{ marginTop: "12px" }}>{email.systemNote}</div>
              )}
            </div>
          )}

          {/* 🔽 TEMPLATE PICKER (Extracted outside the condition so it can render anytime) */}
          {showDraftPicker && (
            <div style={{ marginLeft: "56px", marginTop: "12px", marginBottom: "24px" }}>
              <div style={{ fontSize: "13px", color: "#5f6368", marginBottom: "8px" }}>Choose a draft template below.</div>
              <div className="draft-picker" style={{ background: "#f8f9fa", border: "1px solid #dadce0", padding: "16px", borderRadius: "8px" }}>
                <div className="draft-picker-title" style={{ color: "#202124", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>Choose a draft email template:</div>
                <div className="draft-picker-list" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {DRAFT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      className="draft-picker-item"
                      style={{ border: "1px solid #dadce0", padding: "8px 16px", color: "#3c4043", borderRadius: "100px", background: "#fff", cursor: "pointer", fontSize: "13px" }}
                      onClick={() => {
                        // Keeps existing recipient if replying, otherwise grabs sender email
                        if (!draftTo) {
                          let targetEmail = "";
                          if (email.fromEmail) {
                            targetEmail = email.fromEmail.replace("<", "").replace(">", "").trim();
                          }
                          setDraftTo(targetEmail);
                        }
                        setSelectedDraftTemplate(tpl);
                        setShowDraftPicker(false);
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

         {/* 🔽 INLINE GMAIL REPLY BOX (Pixel Perfect) */}
          {selectedDraftTemplate && (
            <div className="gmail-inline-reply-box" style={{ marginLeft: "56px", marginTop: "12px", border: "1px solid #dadce0", borderRadius: "12px", background: "#fff", padding: "0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", position: "relative", overflow: "hidden" }}>
              
            {/* Top Row: Reply Arrow & Recipient */}
              <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: "#fff", borderBottom: "1px solid transparent", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#5f6368", padding: "4px 8px", borderRadius: "4px", margin: "-4px 8px -4px -8px" }} className="gmail-action-icon">
                  {selectedDraftTemplate.isForward ? (
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginLeft: "2px" }}><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                </div>
                
                <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                  {selectedDraftTemplate.draftId ? (
                    <span style={{ color: "#202124", fontSize: "14px", fontWeight: 500 }}>{draftTo || "(No recipient)"}</span>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        style={{ border: "none", outline: "none", background: "transparent", width: "100%", color: "#202124", fontSize: "14px", fontWeight: 400 }}
                        placeholder={selectedDraftTemplate.isForward ? "To" : "Recipient"}
                      />
                      
                    
                 {/* Suggestion Dropdown */}
                  {(draftTo || "").length > 1 && !(draftTo || "").includes("@") && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: "56px",
                      right: "16px",
                      background: "white",
                      border: "1px solid #dadce0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 2000,
                      maxHeight: "200px",
                      overflowY: "auto",
                      borderRadius: "4px"
                    }}>
                      {Object.entries(combinedContacts)
                        .filter(([name]) => name.toLowerCase().includes((draftTo || "").toLowerCase()))
                        .map(([name, email]) => (
                              <div 
                                key={email}
                                onClick={() => setDraftTo(email)}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f3f4"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                style={{
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "13px",
                                  color: "#202124"
                                }}
                              >
                                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>
                                <span style={{ color: "#5f6368", marginLeft: "15px", whiteSpace: "nowrap" }}>{email}</span>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button className="gmail-action-icon" style={{ margin: "-4px -8px -4px 8px" }} title="Pop out reply">
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                </button>
              </div>

            {/* Text Area */}
                  <div style={{ padding: "0 16px", display: "flex", flexDirection: "column" }}>
                      <textarea
                        autoFocus
                        className="email-draft-textarea"
                        value={selectedDraftTemplate.body || ""}
                        onChange={(e) => setSelectedDraftTemplate((prev) => prev ? { ...prev, body: e.target.value } : prev)}
                        style={{
                          width: "100%", border: "none", outline: "none", minHeight: "150px", maxHeight: "350px", fontSize: "14px", resize: "none",
                          background: "transparent", color: "#202124", whiteSpace: "pre-wrap", overflowY: "auto", boxSizing: "border-box", lineHeight: "1.5", marginTop: "8px"
                        }}
                      />
                  </div>

              {/* ATTACHMENT PREVIEW ROW */}
              {draftAttachments.length > 0 && (
                <div style={{ padding: "8px 16px", borderTop: "1px solid #e0e4f0", display: "flex", gap: "8px", flexWrap: "wrap", background: "#f8f9fa" }}>
                  {draftAttachments.map((file, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #dadce0", borderRadius: "16px", padding: "4px 10px", fontSize: "12px", color: "#3c4043" }}>
                      <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                      <span style={{ color: "#5f6368" }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button 
                        onClick={() => setDraftAttachments(prev => prev.filter((_, i) => i !== idx))} 
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 2px", color: "#5f6368", display: "flex", alignItems: "center" }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    className="btn blue"
                    style={{ borderRadius: "24px", padding: "8px 16px 8px 24px", fontSize: "14px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}
                   onClick={async () => {
                    if (!draftTo.trim()) {
                      setEmail((prev) => prev ? { ...prev, systemNote: "Please add a recipient address." } : prev);
                      return;
                    }

                    // ⚡ 0ms LATENCY: Close draft and show snackbar immediately
                    triggerSnackbar("Message sent");
                    setSelectedDraftTemplate(null);
                    const finalRecipient = draftTo; // Store for the note
                    setDraftTo("");
                    setDraftAttachments([]);

                    try {
                      const base64Attachments = await Promise.all(draftAttachments.map(file => {
                        return new Promise((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve({
                            filename: file.name,
                            mimeType: file.type || "application/octet-stream",
                            content: reader.result.split(',')[1]
                          });
                          reader.readAsDataURL(file);
                        });
                      }));

                      const prefix = selectedDraftTemplate.isForward ? "Fwd:" : "Re:";
                      const replySubject = email?.subject?.startsWith(prefix) ? email.subject : `${prefix} ${email?.subject || "New Message"}`;

                      const res = await fetch("/.netlify/functions/gmail-send-email", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          to: finalRecipient,
                          subject: replySubject,
                          body: selectedDraftTemplate.body.replace(/\*([^*]+)\*/g, "<b>$1</b>"),
                          attachments: base64Attachments 
                        }),
                      });
                      
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
                      
                     setEmail((prev) => prev ? { ...prev, systemNote: `Email sent successfully to: ${finalRecipient}` } : prev);
                    } catch (err) {
                      console.error("Delayed send error:", err);
                      setSnackbar({ show: false, text: "" }); 
                      alert(`Failed to send: ${err.message}`);
                    }
                  }}
                  >
                    Send
                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "6px", marginLeft: "2px", boxSizing: "content-box" }}><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                  </button>
                  
                  {/* Formatting / Paperclip Icons */}
                  <div style={{ display: "flex", alignItems: "center", color: "#5f6368" }}>
                    <input 
                      type="file" 
                      multiple 
                      ref={draftFileInputRef} 
                      style={{ display: "none" }} 
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const validFiles = files.filter(f => f.size <= 4.5 * 1024 * 1024);
                        if (validFiles.length < files.length) alert("Some files were skipped because they exceed the 4.5MB limit.");
                        setDraftAttachments(prev => [...prev, ...validFiles]);
                        e.target.value = "";
                      }} 
                    />
                    <button 
                      className="gmail-action-icon" 
                      onClick={() => draftFileInputRef.current?.click()}
                      title="Attach files"
                      style={{ padding: "6px" }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-3.31-2.69-6-6-6S3 1.69 3 5v11.5c0 3.86 3.14 7 7 7s7-3.14 7-7V6h-1.5z"/></svg>
                    </button>
                    {/* NEW: Three Dots toggle for templates while replying */}
                    <button 
                      className="gmail-action-icon" 
                      title="More options (Templates)" 
                      onClick={() => setShowDraftPicker(prev => !prev)}
                      style={{ padding: "6px" }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>
                  </div>
                </div>

                {/* Delete / Discard Icon */}
                <button 
                  className="gmail-action-icon" 
                  title="Discard draft"
                  onClick={() => {
                    setSelectedDraftTemplate(null);
                    setDraftTo("");
                    setDraftAttachments([]);
                    setEmail((prev) => prev ? { ...prev, systemNote: undefined } : prev);
                  }}
                  style={{ padding: "8px", margin: "-8px" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zM9 8h2v9H9zm4 0h2v9h-2z"/></svg>
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      );

      const previewPane = emailPreview ? (
        <div className="email-preview">
          <div className="email-preview-bar">
            <div className="email-preview-name">{emailPreview.name}</div>
            <button
              className="email-preview-close"
              onClick={() => setEmailPreview(null)}
            >
              Close
            </button>
          </div>
          <iframe
            className="email-preview-frame"
            title={emailPreview.name}
            src={emailPreview.url}
          />
        </div>
      ) : null;

      // Full width until an attachment is clicked, then split view
      return emailPreview ? (
        <div className="email-split">
          {emailPane}
          {previewPane}
        </div>
      ) : (
        <div className="email-full">{emailPane}</div>
      );
    }
  return null;
}

export default GmailApp;
