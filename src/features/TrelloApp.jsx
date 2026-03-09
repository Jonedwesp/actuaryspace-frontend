// src/features/TrelloApp.jsx
import React from "react";
import { avatarFor } from "../utils/avatarUtils.js";
import {
  parseCustomFieldsFromBadges, getCFColorClass, setCardDescription, setCardCustomField,
  PRIORITY_OPTIONS, ACTIVE_OPTIONS, STATUS_OPTIONS, ALL_LABEL_OPTIONS, getLabelStyle, getLabelColor,
  ensureBadgeTypes, getTrelloCoverColor
} from "../utils/trelloUtils.js";
import SmartLink from "../components/SmartLink.jsx";
import ChecklistItemInput from "../components/ChecklistItemInput.jsx";
import ActivityPane, { timeAgo } from "../components/ActivityPane.jsx";
import CustomDropdown from "../components/CustomDropdown.jsx";
import LiveTimer from "../components/LiveTimer.jsx";

const trelloIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%230079bf'/%3E%3Crect x='5' y='5' width='6' height='14' rx='1.5' fill='%23ffffff'/%3E%3Crect x='13' y='5' width='6' height='9' rx='1.5' fill='%23ffffff'/%3E%3C/svg%3E";

export function TrelloApp({
  // --- State ---
  trelloCard, setTrelloCard,
  trelloPreview, setTrelloPreview,
  trelloBuckets, setTrelloBuckets,
  trelloMembers, setTrelloMembers,
  trelloMenuOpen, setTrelloMenuOpen,
  showMoveSubmenu, setShowMoveSubmenu,
  moveTab, setMoveTab,
  moveTargetList, setMoveTargetList,
  moveTargetPos, setMoveTargetPos,
  moveListSearch, setMoveListSearch,
  descEditing, setDescEditing,
  descDraft, setDescDraft,
  showAddMenu, setShowAddMenu,
  addMenuStep, setAddMenuStep,
  checklists, setChecklists,
  newChecklistTitle, setNewChecklistTitle,
  copyFromChecklist, setCopyFromChecklist,
  cardAttachments, setCardAttachments,
  attachLink, setAttachLink,
  attachName, setAttachName,
  showMemberShortcut, setShowMemberShortcut,
  showLabelPicker, setShowLabelPicker,
  currentView, setCurrentView,
  allTrelloLists,
  showAddTime, setShowAddTime,
  manualHours, setManualHours,
  manualMins, setManualMins,
  // --- Refs ---
  trelloAttachmentRef,
  pendingCFRef,
}) {
  if (currentView.app === "trello" && trelloCard) {
    const c = trelloCard;
    const fields = (c.customFields && Object.keys(c.customFields).length)
      ? c.customFields
      : parseCustomFieldsFromBadges(c.badges || []);

   return (
      <div className="trello-modal middle-app-in" style={{ maxWidth: "none", width: "calc(100% - 24px)", margin: "0 auto", transformOrigin: "top center" }}>
        {/* 1. TOP BAR (Icon + Title + Close) */}
        {/* 1. TOP BAR (Icon + Title + Actions) */}
        {/* 1. TOP BAR (Icon + Title + Actions) */}
        {/* 1. TOP BAR (Icon + Title + Actions) */}
                {/* 1. COVER RECTANGLE */}
        {(() => {
          const coverColorMap = { sky: "#6CC3E0", orange: "#FAA53D", blue: "#579DFF", green: "#4BCE97", yellow: "#F5CD47", red: "#F87168", purple: "#9F8FEF" };
          const coverHex = coverColorMap[c.cover?.color];
          return (
            <div style={{
              height: coverHex ? '112px' : '56px',
              background: coverHex || '#ffffff',
              position: 'relative',
              flexShrink: 0,
              borderRadius: '12px 12px 0 0',
            }}>
              {c.fromProductivity && (
                <button
                  onClick={() => { setCurrentView({ app: "productivity", contact: null }); setTrelloCard(null); window.dispatchEvent(new CustomEvent("prodBackToSummary", { detail: c.fromProductivity })); }}
                  style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(0,0,0,0.18)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                  title="Back to Dashboard"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
              )}
              <div style={{ position: 'absolute', top: '50%', right: '20px', transform: 'translateY(-50%)', zIndex: 10 }}>
                {/* ACTIONS: Kebab Menu & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            
            <div className="kebab-wrap" style={{ position: 'relative' }}>
              <button 
                className="trello-close" 
                style={{ fontSize: '18px', paddingBottom: '8px' }} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setTrelloMenuOpen(!trelloMenuOpen); 
                  setShowMoveSubmenu(false); 
                }}
              >
                •••
              </button>

              {/* DROPDOWN MENU */}
              {trelloMenuOpen && (
                <div className="popup-anim-in" style={{ position: 'absolute', right: 0, top: '40px', background: '#ffffff', boxShadow: '0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)', borderRadius: '3px', width: '300px', zIndex: 9999, padding: showMoveSubmenu ? '0' : '8px 0', fontSize: '14px', color: '#172b4d', transformOrigin: 'top right' }}>
                  
                  {!showMoveSubmenu ? (
                    <>
                      <div style={{ padding: '0 12px 8px', borderBottom: '1px solid rgba(9,30,66,0.13)', marginBottom: '8px', fontWeight: 600, textAlign: 'center', fontSize: '14px', color: '#5e6c84' }}>
                        Actions
                      </div>
                      {/* MOVE OPTION */}
                      <div 
                        style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#172b4d' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#091e420f'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setMoveTargetList(c.listId); 
                          
                          // ⚡ Set exact current position and clear old searches
                          const currentBucket = trelloBuckets.find(b => b.id === c.listId);
                          const currentPos = currentBucket ? currentBucket.cards.findIndex(x => x.id === c.id) + 1 : 1;
                          setMoveTargetPos(currentPos > 0 ? currentPos : 1);
                          
                          setMoveTab("outbox");
                          setMoveListSearch(""); 
                          setShowMoveSubmenu(true); 
                        }}
                      >
                        <span>Move</span>
                        <span>›</span>
                      </div>

                      {/* ARCHIVE / RESTORE OPTION */}
                      {c.isArchived ? (
                        <div 
                          style={{ padding: '8px 16px', cursor: 'pointer', color: '#172b4d' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#091e420f'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const cid = c.id;
                            
                            // Optimistic Update
                            window.dispatchEvent(new Event("pauseTrelloPolling"));
                            setTrelloCard(prev => ({ ...prev, isArchived: false, boardList: "Restored" }));
                            setTrelloMenuOpen(false);

                            try {
                              await fetch("/.netlify/functions/trello-restore", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ cardId: cid })
                              });
                            } catch (err) { console.error("Restore failed", err); }
                          }}
                        >
                          Restore
                        </div>
                      ) : (
                        <div 
                          style={{ padding: '8px 16px', cursor: 'pointer', color: '#172b4d' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#091e420f'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const cid = c.id;
                            
                            // Optimistic Update
                            window.dispatchEvent(new Event("pauseTrelloPolling"));
                            setTrelloBuckets(prev => prev.map(b => ({ ...b, cards: b.cards.filter(card => card.id !== cid) })));
                            setTrelloMenuOpen(false);
                            setTrelloCard(null);

                            try {
                              await fetch("/.netlify/functions/trello-archive", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ cardId: cid })
                              });
                            } catch (err) { console.error("Archive failed", err); }
                          }}
                        >
                          Archive
                        </div>
                      )}
                    </>
                  ) : (
                    /* SUB-MENU: MOVE CARD UI */
                    <div style={{ padding: '12px' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', position: 'relative', color: '#5e6c84' }}>
                        <button onClick={(e) => {e.stopPropagation(); setShowMoveSubmenu(false);}} style={{ position: 'absolute', left: 0, border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'18px' }}>‹</button>
                        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: '14px' }}>Move card</div>
                        <button onClick={(e) => {e.stopPropagation(); setTrelloMenuOpen(false); setShowMoveSubmenu(false);}} style={{ position: 'absolute', right: 0, border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'16px' }}>✕</button>
                      </div>
                      
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '2px solid #ebecf0' }}>
                        <div onClick={(e) => {e.stopPropagation(); setMoveTab('inbox'); setMoveTargetList(c.listId);}} style={{ paddingBottom: '8px', cursor: 'pointer', marginBottom: '-2px', color: moveTab === 'inbox' ? '#0052cc' : '#5e6c84', borderBottom: moveTab === 'inbox' ? '2px solid #0052cc' : '2px solid transparent', fontWeight: moveTab === 'inbox' ? 600 : 400 }}>Inbox</div>
                        <div onClick={(e) => {e.stopPropagation(); setMoveTab('outbox');}} style={{ paddingBottom: '8px', cursor: 'pointer', marginBottom: '-2px', color: moveTab === 'outbox' ? '#0052cc' : '#5e6c84', borderBottom: moveTab === 'outbox' ? '2px solid #0052cc' : '2px solid transparent', fontWeight: moveTab === 'outbox' ? 600 : 400 }}>Board</div>
                      </div>

                      {/* Body */}
                      {moveTab === 'inbox' && (
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#5e6c84', marginBottom:'4px' }}>Select position</label>
                          <select 
                             value={moveTargetPos} 
                             onChange={(e) => setMoveTargetPos(Number(e.target.value))} 
                             style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', cursor: 'pointer', outline: 'none' }} 
                             onClick={e => e.stopPropagation()}
                          >
                             {Array.from({ length: Math.max(1, trelloBuckets.find(b => b.id === c.listId)?.cards.length || 1) }, (_, i) => (
                                <option key={i+1} value={i+1}>{i+1}</option>
                             ))}
                          </select>
                        </div>
                      )}

                      {moveTab === 'outbox' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                          {/* 🔍 SEARCH BAR */}
                          <div>
                            <input 
                              type="text" 
                              placeholder="Search board lists..." 
                              value={moveListSearch}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setMoveListSearch(val);
                                  
                                  // ⚡ AUTO-SELECT FIX
                                  const uniqueMap = new Map();
                                  allTrelloLists.forEach(l => {
                                      if (!uniqueMap.has(l.title)) uniqueMap.set(l.title, l);
                                  });
                                  let unique = Array.from(uniqueMap.values());
                                  
                                  // ⚡ Remove junk lists after "Submitted August 2025"
                                  const cutoffIndex = unique.findIndex(l => l.title.toLowerCase().trim() === "submitted august 2025");
                                  if (cutoffIndex !== -1) unique = unique.slice(0, cutoffIndex + 1);

                                  const filtered = unique.filter(l => l.title.toLowerCase().includes(val.toLowerCase()));
                                  
                                  if (filtered.length > 0) {
                                      const firstMatch = filtered[0];
                                      setMoveTargetList(firstMatch.id);
                                      
                                      if (firstMatch.id === c.listId) {
                                          const cb = trelloBuckets.find(b => b.id === c.listId);
                                          const cp = cb ? cb.cards.findIndex(x => x.id === c.id) + 1 : 1;
                                          setMoveTargetPos(cp > 0 ? cp : 1);
                                      } else {
                                          setMoveTargetPos(1);
                                      }
                                  }
                              }}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', outline: 'none', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 2 }}>
                              <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#5e6c84', marginBottom:'4px' }}>List</label>
                              <select 
                                 value={moveTargetList} 
                                 onChange={(e) => { setMoveTargetList(e.target.value); setMoveTargetPos(1); }} 
                                 style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', cursor: 'pointer', outline: 'none' }} 
                                 onClick={e => e.stopPropagation()}
                              >
                                 {(() => {
                                    // ⚡ 1. Deduplicate by name to remove Trello ghosts
                                    const uniqueMap = new Map();
                                    allTrelloLists.forEach(l => {
                                        if (!uniqueMap.has(l.title)) uniqueMap.set(l.title, l);
                                    });
                                    let unique = Array.from(uniqueMap.values());
                                    
                                    // ⚡ 1.5 Cut off junk lists after "Submitted August 2025"
                                    const cutoffIndex = unique.findIndex(l => l.title.toLowerCase().trim() === "submitted august 2025");
                                    if (cutoffIndex !== -1) unique = unique.slice(0, cutoffIndex + 1);

                                    // ⚡ 2. Filter the visual options by your search text
                                    const search = (moveListSearch || "").toLowerCase();
                                    const filtered = unique.filter(l => l.title.toLowerCase().includes(search));

                                    if (filtered.length === 0) return <option value="">No match found</option>;
                                    return filtered.map(b => <option key={b.id} value={b.id}>{b.title}</option>);
                                 })()}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#5e6c84', marginBottom:'4px' }}>Position</label>
                              <select 
                                 value={moveTargetPos} 
                                 onChange={(e) => setMoveTargetPos(Number(e.target.value))} 
                                 style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', cursor: 'pointer', outline: 'none' }} 
                                 onClick={e => e.stopPropagation()}
                              >
                                 {(() => {
                                    // ⚡ 0ms LAG FIX: Check local trelloBuckets first for instant count
                                    const localBucket = trelloBuckets.find(b => b.id === moveTargetList);
                                    const globalBucket = allTrelloLists.find(b => b.id === moveTargetList);
                                    
                                    // Priority: Local State > Global Polled State > 0
                                    const currentCount = localBucket ? localBucket.cards.length : (globalBucket?.cardsLength || 0);
                                    
                                    const isSameList = moveTargetList === c.listId;
                                    const maxPos = isSameList ? Math.max(1, currentCount) : currentCount + 1;
                                    
                                    return Array.from({ length: maxPos }, (_, i) => (
                                       <option key={i+1} value={i+1}>{i+1}</option>
                                    ));
                                 })()}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      <button 
                        style={{ width: '100%', padding: '8px', borderRadius: '3px', fontWeight: 600, justifyContent: 'center', background: '#0052cc', color: '#fff', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0065ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#0052cc'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          
                          const cid = c.id;
                          const targetId = moveTargetList;
                          const newIndex = moveTargetPos - 1; // 0-based for arrays
                          const targetName = trelloBuckets.find(b => b.id === targetId)?.title || c.boardList;

                          // 1. Optimistic Update: Move instantly on UI
                          window.dispatchEvent(new Event("pauseTrelloPolling"));
                          
                          // 2. ONLY notify if the card actually changed lists
                          // FIX: Directly use the card's known boardList instead of the missing Ref!
                          if (c.boardList && c.boardList !== targetName) {
                              window.dispatchEvent(new CustomEvent("notify", {
                                  detail: {
                                      text: `Card moved to ${targetName}: ${c.title}`,
                                      alt: "Trello",
                                      icon: trelloIcon,
                                      cardData: c,
                                      timestamp: new Date().toISOString()
                                  }
                              }));
                          }

                          // 3. Update memory to stop background poller from doing it again
                          window.dispatchEvent(new CustomEvent("updateTrelloMemory", { detail: { cardId: cid, listName: targetName } })); 
                          
                          setTrelloBuckets(prev => {
                            let cardToMove = null;
                            const stripped = prev.map(b => {
                                if (b.id === c.listId) {
                                    const idx = b.cards.findIndex(x => x.id === cid);
                                    if (idx > -1) {
                                        cardToMove = b.cards[idx];
                                        const newCards = [...b.cards];
                                        newCards.splice(idx, 1);
                                        return { ...b, cards: newCards };
                                    }
                                }
                                return b;
                            });
                            if (!cardToMove) return prev;
                            return stripped.map(b => {
                                if (b.id === targetId) {
                                    const newCards = [...b.cards];
                                    newCards.splice(newIndex, 0, cardToMove);
                                    return { ...b, cards: newCards };
                                }
                                return b;
                            });
                          });

                          setTrelloCard(prev => ({ ...prev, listId: targetId, boardList: targetName }));
                          setTrelloMenuOpen(false);
                          setShowMoveSubmenu(false);

                          // 2. Background Sync
                          try {
                            await fetch("/.netlify/functions/trello-move", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ cardId: cid, targetListId: targetId, newIndex: newIndex })
                            });
                          } catch (err) { console.error("Move failed", err); }
                        }}
                      >
                        Move
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              className="trello-close"
              onClick={() => { setTrelloMenuOpen(false); setTrelloCard(null); }}
            >✕</button>
          </div>
              </div>
            </div>
          );
        })()}
        {/* HORIZONTAL SEPARATOR */}
        <div style={{ height: '1px', background: '#c1c7d0', flexShrink: 0 }} />

        {/* 2. BODY (Columns) */}
        <div className="trello-modal-body" style={{ display: 'flex', gap: '0' }}>

          {/* LEFT COLUMN (55%) */}
          <div className="trello-main-col" style={{ flex: "5.5", minWidth: 0, paddingTop: '20px', paddingRight: '32px' }}>
            <div className="trello-header-main">
            <div className="trello-icon-header">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="2"/>
               </svg>
            </div>
            <div style={{ flex: 1 }}>
              <input 
                className="trello-title-input" 
                value={c.title} 
                onChange={(e) => setTrelloCard(prev => ({...prev, title: e.target.value}))}
              />
            </div>
          </div>
            
            {/* Action Row (Buttons under title) */}
            <div className="trello-action-row">
               
               {/* 👇 NEW: Add Menu Wrapper & Popover UI */}
               <div className="add-menu-wrap" style={{ position: 'relative' }}>
                 <button 
                   className="t-btn-gray"
                   onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); setAddMenuStep("main"); }}
                 >
                    <span>+</span> Add
                 </button>

                 {showAddMenu && (
                   <div className="popup-anim-in" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#fff', border: '1px solid #dfe1e6', borderRadius: '3px', boxShadow: '0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)', width: '300px', zIndex: 1000, color: '#172b4d', fontSize: '14px', transformOrigin: 'top left' }}>
                     
                     {/* 1. MAIN MENU */}
                     {addMenuStep === "main" && (
                       <>
                         <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 8px', borderBottom: '1px solid #091e4221', marginBottom: '8px', position: 'relative' }}>
                           <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: '#5e6c84', fontSize: '14px' }}>Add to card</div>
                           <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(false); }} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'16px', position: 'absolute', right: '12px' }}>✕</button>
                         </div>
                         <div style={{ padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                           <div onClick={(e) => { e.stopPropagation(); setAddMenuStep("members"); }} style={{ padding: '8px', borderRadius: '3px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.background = '#091e420f'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                             <span style={{ fontSize: '16px' }}>👤</span><div><div style={{ fontWeight: 500 }}>Members</div><div style={{ fontSize: '12px', color: '#5e6c84' }}>Assign members</div></div>
                           </div>
                           <div onClick={(e) => { e.stopPropagation(); setAddMenuStep("checklist"); }} style={{ padding: '8px', borderRadius: '3px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.background = '#091e420f'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                             <span style={{ fontSize: '16px' }}>☑️</span><div><div style={{ fontWeight: 500 }}>Checklist</div><div style={{ fontSize: '12px', color: '#5e6c84' }}>Add subtasks</div></div>
                           </div>
                           <div 
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               setAddMenuStep("attachment");
                             }} 
                             style={{ padding: '8px', borderRadius: '3px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }} 
                             onMouseEnter={e => e.currentTarget.style.background = '#091e420f'} 
                             onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                           >
                             <span style={{ fontSize: '16px' }}>📎</span><div><div style={{ fontWeight: 500 }}>Attachment</div><div style={{ fontSize: '12px', color: '#5e6c84' }}>Add links, pages, work items, and more</div></div>
                           </div>
                         </div>
                       </>
                     )}

                     {/* 2. CHECKLIST CREATION POPOVER */}
                     {addMenuStep === "checklist" && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 8px', borderBottom: '1px solid #091e4221', marginBottom: '8px', position: 'relative' }}>
                            <button onClick={(e) => { e.stopPropagation(); setAddMenuStep("main"); }} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'18px', position: 'absolute', left: '12px' }}>‹</button>
                            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: '#5e6c84', fontSize: '14px' }}>Add checklist</div>
                            <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(false); }} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'16px', position: 'absolute', right: '12px' }}>✕</button>
                          </div>
                          <div style={{ padding: '0 12px 12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#5e6c84', marginBottom: '4px' }}>Title</label>
                            <input autoFocus value={newChecklistTitle} onChange={e => setNewChecklistTitle(e.target.value)} onClick={e => e.stopPropagation()} style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #0079bf', outline: 'none', marginBottom: '16px', color: '#172b4d', fontSize: '14px', boxSizing: 'border-box' }} />

                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#5e6c84', marginBottom: '4px' }}>Copy items from...</label>
                            <select value={copyFromChecklist} onChange={e => setCopyFromChecklist(e.target.value)} onClick={e => e.stopPropagation()} style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', outline: 'none', marginBottom: '16px', background: '#fafbfc', color: '#172b4d', fontSize: '14px', boxSizing: 'border-box' }}>
                              <option value="">(none)</option>
                              {checklists.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                            </select>

                            <button 
                               className="btn-blue" 
                               onClick={async (e) => {
                                  e.stopPropagation();
                                  const title = newChecklistTitle || "Checklist";
                                  const tempId = "temp-" + Date.now();
                                  
                                  // Optimistic Update
                                  setChecklists(prev => [...prev, { id: tempId, name: title, checkItems: [] }]);
                                  setShowAddMenu(false);
                                  setNewChecklistTitle("Checklist"); 
                                  setCopyFromChecklist("");

                                  try {
                                      const res = await fetch("/.netlify/functions/trello-checklists", {
                                          method: "POST",
                                          body: JSON.stringify({ action: 'create_checklist', cardId: c.id, name: title, idChecklistSource: copyFromChecklist || null })
                                      });
                                      const realCl = await res.json();
                                      setChecklists(prev => prev.map(cl => cl.id === tempId ? realCl : cl));
                                  } catch(err) { console.error(err); }
                               }} 
                               style={{ padding: '6px 12px', borderRadius: '3px', border: 'none', background: '#0052cc', color: 'white', fontWeight: 500, cursor: 'pointer' }}
                            >
                               Add
                            </button>
                          </div>
                        </>
                     )}
{/* 2.5 ATTACHMENT POPOVER */}
                     {addMenuStep === "attachment" && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 8px', borderBottom: '1px solid #091e4221', marginBottom: '8px', position: 'relative' }}>
                            <button onClick={(e) => { e.stopPropagation(); setAddMenuStep("main"); }} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'18px', position: 'absolute', left: '12px' }}>‹</button>
                            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: '#5e6c84', fontSize: '14px' }}>Attach</div>
                            <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(false); }} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'16px', position: 'absolute', right: '12px' }}>✕</button>
                          </div>
                          
                          <div style={{ padding: '0 12px 12px' }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: '#172b4d', marginBottom: '4px' }}>Attach a file from your computer</div>
                            <div style={{ fontSize: '14px', color: '#5e6c84', marginBottom: '12px', lineHeight: 1.4 }}>You can also drag and drop files to upload them.</div>
                            
                            <button
                              className="t-btn-gray"
                              style={{ width: '100%', justifyContent: 'center', padding: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}
                              onClick={(e) => {
                                 e.stopPropagation();
                                 trelloAttachmentRef.current?.click(); // Opens computer files
                                 setShowAddMenu(false);
                              }}
                            >
                              Choose a file
                            </button>

                            <hr style={{ border: 'none', borderTop: '1px solid #091e4221', margin: '0 -12px 16px -12px' }} />

                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#5e6c84', marginBottom: '4px' }}>Search or paste a link <span style={{color: '#eb5a46'}}>*</span></label>
                            <input
                              type="text"
                              autoFocus
                              value={attachLink}
                              onChange={e => setAttachLink(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder="Find recent links or paste a new link"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #0079bf', outline: 'none', marginBottom: '16px', color: '#172b4d', fontSize: '14px', boxSizing: 'border-box' }}
                            />

                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#5e6c84', marginBottom: '4px' }}>Display text (optional)</label>
                            <input
                              type="text"
                              value={attachName}
                              onChange={e => setAttachName(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder="Text to display"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', outline: 'none', marginBottom: '4px', color: '#172b4d', fontSize: '14px', boxSizing: 'border-box' }}
                            />
                            <div style={{ fontSize: '12px', color: '#5e6c84', marginBottom: '16px' }}>Give this link a title or description</div>

                            <button
                              className="btn-blue"
                              style={{ padding: '6px 16px', borderRadius: '3px', border: 'none', background: attachLink.trim() ? '#0052cc' : '#091e420f', color: attachLink.trim() ? 'white' : '#a5adba', fontWeight: 500, cursor: attachLink.trim() ? 'pointer' : 'not-allowed' }}
                              disabled={!attachLink.trim()}
                              onClick={async (e) => {
                                 e.stopPropagation();
                                 if (!attachLink.trim()) return;

                                 triggerSnackbar("Attaching link...");
                                 setShowAddMenu(false);
                                 setAttachLink("");
                                 setAttachName("");

                                 try {
                                     const res = await fetch("/.netlify/functions/trello-attach-link", {
                                         method: "POST",
                                         body: JSON.stringify({ cardId: c.id, url: attachLink, name: attachName })
                                     });
                                     if (res.ok) {
                                         const result = await res.json();
                                         triggerSnackbar("Link attached successfully!");
                                         // ⚡ Push instantly to UI
                                         setCardAttachments(prev => [...prev, result.attachment]);
                                     } else {
                                         triggerSnackbar("Failed to attach link");
                                     }
                                 } catch(err) { console.error(err); }
                              }}
                            >
                              Insert
                            </button>
                          </div>
                        </>
                     )}
                     {/* 3. MEMBERS ASSIGNMENT POPOVER */}
                     {addMenuStep === "members" && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 8px', borderBottom: '1px solid #091e4221', marginBottom: '8px', position: 'relative' }}>
                            <button onClick={(e) => { e.stopPropagation(); setAddMenuStep("main"); }} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'18px', position: 'absolute', left: '12px' }}>‹</button>
                            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: '#5e6c84', fontSize: '14px' }}>Members</div>
                            <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(false); }} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'16px', position: 'absolute', right: '12px' }}>✕</button>
                          </div>
                          <div style={{ padding: '0 12px 12px', maxHeight: '300px', overflowY: 'auto' }}>
                            <div style={{ fontWeight: 600, fontSize: '12px', color: '#5e6c84', marginBottom: '8px' }}>Board members</div>
                            {trelloMembers.length === 0 && <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading members...</div>}
                            
                            {/* DYNAMIC SORT */}
                            {(() => {
                               const sortedMembers = [...trelloMembers].sort((a, b) => {
                                  const aAssigned = (c.members || []).some(m => m === a.fullName || m === a.id);
                                  const bAssigned = (c.members || []).some(m => m === b.fullName || m === b.id);
                                  if (aAssigned === bAssigned) return a.fullName.localeCompare(b.fullName);
                                  return aAssigned ? -1 : 1;
                               });

                               return sortedMembers.map(member => {
                                  const isAssigned = (c.members || []).some(m => m === member.fullName || m === member.id);
                                  return (
                                    <div 
                                      key={member.id} 
                                      onMouseEnter={e => e.currentTarget.style.background = isAssigned ? '#e6fcff' : '#091e420f'} 
                                      onMouseLeave={e => e.currentTarget.style.background = isAssigned ? '#e6fcff' : 'transparent'}
                                      onClick={async (e) => {
                                         e.stopPropagation();
                                         const newMembers = isAssigned 
                                           ? c.members.filter(m => m !== member.fullName && m !== member.id)
                                           : [...(c.members || []), member.fullName];
                                           
                                         window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Members", ttlMs: 10000 } }));
                                         setTrelloCard(prev => ({ ...prev, members: newMembers }));
                                         
                                         try {
                                           fetch("/.netlify/functions/trello-toggle-member", {
                                             method: "POST", headers: { "Content-Type": "application/json" },
                                             body: JSON.stringify({ cardId: c.id, memberId: member.id, shouldAdd: !isAssigned })
                                           });
                                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                             detail: { cardId: c.id, updater: old => ({ ...old, people: newMembers }) }
                                           }));
                                         } catch (err) { console.error("Member toggle failed", err); }
                                      }} 
                                      style={{ display: 'flex', alignItems: 'center', padding: '6px', cursor: 'pointer', borderRadius: '3px', background: isAssigned ? '#e6fcff' : 'transparent', marginBottom: '2px' }}
                                    >
                                      {(avatarFor(member.fullName) || member.avatarUrl)
                                        ? <img src={avatarFor(member.fullName) || member.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', marginRight: 12 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                        : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dfe1e6', color: '#172b4d', marginRight: 12, display: 'grid', placeItems: 'center', fontWeight: 600 }}>{member.fullName[0]}</div>
                                      }
                                      <span style={{ flex: 1, fontWeight: 500, fontSize: '14px' }}>{member.fullName}</span>
                                      {isAssigned && <span style={{ color: '#0079bf', fontWeight: 'bold' }}>✓</span>}
                                    </div>
                                  );
                               });
                            })()}
                          </div>
                        </>
                     )}

                   </div>
                 )}
               </div>
            </div>

            {/* Members & Labels Section (Fixed Layout & Sizing) */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 24, paddingLeft: 40, flexWrap: 'wrap' }}>
               
               {/* 1. Members Group */}
               <div>
                  <h3 className="trello-group-label">Members</h3>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                     {(c.members || []).map((m, i) => {
                        const img = avatarFor(m);
                        
                        // ⚡ FIX: Safe string calculation prevents crashes on empty or weird member IDs
                        const initials = String(m || "U").split(' ').map(n => n?.[0] || "").join('').substring(0, 2).toUpperCase();
                        
                        return (
                           <div 
                              key={i} 
                              title={m}
                              style={{ 
                                width: '32px', height: '32px', borderRadius: '50%', 
                                background: img ? 'transparent' : '#dfe1e6', 
                                color: '#172b4d', display: 'grid', placeItems: 'center', 
                                fontWeight: 600, fontSize: '13px', overflow: 'hidden'
                              }}
                           >
                              {img ? <img src={img} alt={m} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                           </div>
                        );
                     })}
                     {/* SHORTCUT MENU WRAPPER */}
                     <div className="member-shortcut-wrap" style={{ position: 'relative' }}>
                         <button 
                            className="round-btn-gray" 
                            title="Add member"
                            style={{ display: 'grid', placeItems: 'center', padding: 0 }}
                            onClick={(e) => { e.stopPropagation(); setShowMemberShortcut(!showMemberShortcut); }}
                         >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 11V5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5V11H5C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13H11V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13Z"/></svg>
                         </button>

                         {showMemberShortcut && (
                            <div className="popup-anim-in" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#fff', border: '1px solid #dfe1e6', borderRadius: '3px', boxShadow: '0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)', width: '300px', zIndex: 1000, color: '#172b4d', fontSize: '14px', transformOrigin: 'top left' }}>
                               <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 8px', borderBottom: '1px solid #091e4221', marginBottom: '8px', position: 'relative' }}>
                                 <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: '#5e6c84', fontSize: '14px' }}>Members</div>
                                 <button onClick={() => setShowMemberShortcut(false)} style={{ border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'16px', position: 'absolute', right: '12px' }}>✕</button>
                               </div>
                               <div style={{ padding: '0 12px 12px', maxHeight: '300px', overflowY: 'auto' }}>
                                 <div style={{ fontWeight: 600, fontSize: '12px', color: '#5e6c84', marginBottom: '8px' }}>Board members</div>
                                 {trelloMembers.length === 0 && <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading members...</div>}
                                 
                                 {(() => {
                                    const sortedMembers = [...trelloMembers].sort((a, b) => {
                                       const aAssigned = (c.members || []).some(m => m === a.fullName || m === a.id);
                                       const bAssigned = (c.members || []).some(m => m === b.fullName || m === b.id);
                                       if (aAssigned === bAssigned) return a.fullName.localeCompare(b.fullName);
                                       return aAssigned ? -1 : 1;
                                    });

                                    return sortedMembers.map(member => {
                                       const isAssigned = (c.members || []).some(m => m === member.fullName || m === member.id);
                                       return (
                                         <div 
                                           key={member.id} 
                                           onMouseEnter={e => e.currentTarget.style.background = isAssigned ? '#e6fcff' : '#091e420f'} 
                                           onMouseLeave={e => e.currentTarget.style.background = isAssigned ? '#e6fcff' : 'transparent'}
                                           onClick={async (e) => {
                                              e.stopPropagation();
                                              const newMembers = isAssigned 
                                                ? c.members.filter(m => m !== member.fullName && m !== member.id)
                                                : [...(c.members || []), member.fullName];
                                                
                                              window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Members", ttlMs: 10000 } }));
                                              setTrelloCard(prev => ({ ...prev, members: newMembers }));
                                              
                                              try {
                                                fetch("/.netlify/functions/trello-toggle-member", {
                                                  method: "POST", headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({ cardId: c.id, memberId: member.id, shouldAdd: !isAssigned })
                                                });
                                                window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                                  detail: { cardId: c.id, updater: old => ({ ...old, people: newMembers }) }
                                                }));
                                              } catch (err) { console.error("Member toggle failed", err); }
                                           }} 
                                           style={{ display: 'flex', alignItems: 'center', padding: '6px', cursor: 'pointer', borderRadius: '3px', background: isAssigned ? '#e6fcff' : 'transparent', marginBottom: '2px' }}
                                         >
                                           {(avatarFor(member.fullName) || member.avatarUrl)
                                       ? <img src={avatarFor(member.fullName) || (member.avatarUrl.endsWith('.png') ? member.avatarUrl : member.avatarUrl + '/50.png')} alt="" style={{ width: 32, height: 32, borderRadius: '50%', marginRight: 12, objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                       : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dfe1e6', color: '#172b4d', marginRight: 12, display: 'grid', placeItems: 'center', fontWeight: 600 }}>
                                           {member.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                         </div>
                                     }
                                           <span style={{ flex: 1, fontWeight: 500, fontSize: '14px' }}>{member.fullName}</span>
                                           {isAssigned && <span style={{ color: '#0079bf', fontWeight: 'bold' }}>✓</span>}
                                         </div>
                                       );
                                    });
                                 })()}
                               </div>
                            </div>
                         )}
                     </div>
                  </div>
               </div>

               {/* 2. Labels Group */}
               <div style={{ position: 'relative' }}>
                  <h3 className="trello-group-label">Labels</h3>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                     {/* Render actual active labels - NOW CLICKABLE */}
                     {(c.labels || []).map((l, i) => {
                        const style = getLabelStyle(l);
                        return (
                           <div 
                             key={i} 
                             className="label-pill-large" 
                             style={style}
                             onClick={(e) => { e.stopPropagation(); setShowLabelPicker(true); }}
                           >
                              {l}
                           </div>
                        );
                     })}
                     
                     {/* Plus Button */}
                     <button 
                        className="rect-btn-gray" 
                        title="Add label"
                        style={{ display: 'grid', placeItems: 'center', padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); setShowLabelPicker(!showLabelPicker); }}
                     >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 11V5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5V11H5C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13H11V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13Z"/></svg>
                     </button>

                     {/* 🔽 POPUP LABEL PICKER (Checkboxes) 🔽 */}
                     {showLabelPicker && (
                       <div className="label-picker-popover" onClick={(e) => e.stopPropagation()}>
                         <div className="label-picker-header">
                           <span>Labels</span>
                           <button 
                             className="label-picker-close" 
                             onClick={(e) => { e.stopPropagation(); setShowLabelPicker(false); }}
                           >✕</button>
                         </div>
                         <div className="label-picker-list">
                           {ALL_LABEL_OPTIONS.map((opt) => {
                             const isActive = (c.labels || []).includes(opt.name);
                             return (
                               <div key={opt.name} className="label-picker-row">
                                 <div 
                                   className="label-picker-pill" 
                                   style={{ backgroundColor: opt.bg, color: opt.color, display: 'flex', alignItems: 'center', gap: '8px' }}
                                   onClick={async (e) => {
                                      e.stopPropagation(); // Prevent closing
                                      
                                      // 1. Optimistic Update
                                      const newLabels = isActive 
                                        ? c.labels.filter(l => l !== opt.name)
                                        : [...(c.labels || []), opt.name];
                                      
                                      setTrelloCard(prev => ({ ...prev, labels: newLabels }));

                                      try {
                                        // 2. Call Backend
                                        await fetch("/.netlify/functions/trello-toggle-label", {
                                          method: "POST",
                                          body: JSON.stringify({ 
                                            cardId: c.id, 
                                            labelName: opt.name, 
                                            shouldAdd: !isActive 
                                          })
                                        });
                                        
                                        // 3. Patch bucket
                                        window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                          detail: { cardId: c.id, updater: old => ({ ...old, labels: newLabels }) }
                                        }));
                                      } catch(err) {
                                        console.error("Label toggle failed", err);
                                      }
                                   }}
                                 >
                                   {/* CHECKBOX ON LEFT */}
                                   <input 
                                     type="checkbox" 
                                     checked={isActive} 
                                     readOnly 
                                     style={{ cursor: 'pointer', width: 16, height: 16 }} 
                                   />
                                   <span style={{flex: 1}}>{opt.name}</span>
                                 </div>
                                 <button className="label-edit-icon">✎</button>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     )}
                  </div>
               </div>
            </div>

            {/* Description */}
            <div className="trello-section">
              <div className="trello-section-icon">≡</div>
              <div className="trello-section-header">
                 <h3 className="trello-h3">Description</h3>
                 {!descEditing && (
                   <button 
                     className="t-btn-gray"
                     onClick={() => { setDescDraft(c.description || ""); setDescEditing(true); }}
                   >Edit</button>
                 )}
              </div>
              {!descEditing ? (
                 <div 
                   className="desc-box-fake"
                   onClick={() => { setDescDraft(c.description || ""); setDescEditing(true); }}
                   style={{ minHeight: '60px', whiteSpace: 'pre-wrap' }}
                 >
                   {c.description || <span style={{color:'#5e6c84'}}>Add a more detailed description...</span>}
                 </div>
              ) : (
                 <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
                   <textarea 
                     className="trello-title-input"
                     style={{ minHeight: 108, border: '2px solid #0079bf', background:'#fff', fontSize:14, fontWeight:400, padding: '8px 12px', resize:'none' }}
                     value={descDraft}
                     onChange={e => setDescDraft(e.target.value)}
                     autoFocus
                     placeholder="Add a more detailed description..."
                   />
                   <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button 
                        className="btn-blue"
                        onClick={async () => {
                          const newDesc = descDraft;
                          const prevDesc = c.description;
                          
                          // 1. Optimistic Update (Instant on screen)
                          setTrelloCard(prev => ({ ...prev, description: newDesc }));
                          setDescEditing(false);

                          try {
                            // 2. Send to Trello (Backend)
                            await setCardDescription(c.id, newDesc);
                            
                            // 3. Update the hidden list view so it sticks if you close/reopen
                            window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ ...old, description: newDesc }) }
                            }));
                          } catch (err) {
                            console.error(err);
                            // Revert on failure
                            setTrelloCard(prev => ({ ...prev, description: prevDesc }));
                            alert("Failed to save description");
                          }
                        }}
                      >
                        Save
                      </button>
                      <button 
                        className="t-btn-gray" 
                        onClick={() => setDescEditing(false)}
                      >
                        Cancel
                      </button>
             </div>
                 </div>
              )}
            </div>

           {/* Custom Fields (GRID LAYOUT) */}
            <div className="trello-section">
               <div className="trello-section-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <rect x="3" y="3" width="18" height="18" rx="2" />
                     <line x1="3" y1="9" x2="21" y2="9" />
                  </svg>
               </div>
               <div className="trello-section-header">
                  <h3 className="trello-h3">Custom Fields</h3>
               </div>
               
               <div className="cf-grid">
                 {/* 1. Priority */}
                 <div className="cf-item">
                    <span className="cf-label">Priority</span>
                    <CustomDropdown
                       field="Priority"
                       options={PRIORITY_OPTIONS}
                       value={fields.Priority || fields.priority || ""}
                       onChange={async (val) => {
                          setTrelloCard(prev => {
                             const cleanBadges = (prev.badges || []).filter(b => !b.text.startsWith("Priority:"));
                             if (val) cleanBadges.push({ text: `Priority: ${val}`, isBottom: true });
                             return { 
                                ...prev, 
                                badges: ensureBadgeTypes(cleanBadges),
                                customFields: { ...prev.customFields, Priority: val }
                             };
                          });

                          window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Priority" } }));

                          try {
                             await fetch("/.netlify/functions/trello-set-custom-field", {
                                method: "POST",
                                body: JSON.stringify({ 
                                   cardId: c.id, 
                                   fieldName: "Priority", 
                                   valueText: val 
                                })
                             });
                             window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                detail: { cardId: c.id, updater: old => ({ ...old, customFields: { ...old.customFields, Priority: val } }) }
                             }));
                          } catch (err) { console.error("Priority save failed", err); }
                       }} 
                    />
                 </div>

                 {/* 2. Status */}
                 <div className="cf-item">
                    <span className="cf-label">Status</span>
                    <CustomDropdown
                       field="Status"
                       options={STATUS_OPTIONS}
                       value={fields.Status || fields.status || ""}
                       onChange={async (val) => {
                          setTrelloCard(prev => {
                             const cleanBadges = (prev.badges || []).filter(b => !b.text.startsWith("Status:"));
                             if (val) cleanBadges.push({ text: `Status: ${val}`, isBottom: true });
                             return { 
                                ...prev, 
                                badges: ensureBadgeTypes(cleanBadges),
                                customFields: { ...prev.customFields, Status: val }
                             };
                          });
                          
                          window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Status" } }));

                          try {
                             await fetch("/.netlify/functions/trello-set-custom-field", {
                                method: "POST",
                                body: JSON.stringify({ 
                                   cardId: c.id, 
                                   fieldName: "Status", 
                                   valueText: val 
                                })
                             });
                             window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                detail: { cardId: c.id, updater: old => ({ ...old, customFields: { ...old.customFields, Status: val } }) }
                             }));
                          } catch (err) { console.error("Status save failed", err); }
                       }}
                    />
                 </div>

               {/* 3. Active */}
                 <div className="cf-item">
                    <span className="cf-label">Active</span>
                    <CustomDropdown
                       field="Active"
                       options={ACTIVE_OPTIONS}
                       value={fields.Active || fields.active || ""}
                       onChange={async (val) => {
                          setTrelloCard(prev => {
                             const cleanBadges = (prev.badges || []).filter(b => !b.text.startsWith("Active:"));
                             if (val) cleanBadges.push({ text: `Active: ${val}`, isBottom: true });
                             return { 
                                ...prev, 
                                badges: ensureBadgeTypes(cleanBadges),
                                customFields: { ...prev.customFields, Active: val }
                             };
                          });

                          window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Active" } }));

                          try {
                             await fetch("/.netlify/functions/trello-set-custom-field", {
                                method: "POST",
                                body: JSON.stringify({ 
                                   cardId: c.id, 
                                   fieldName: "Active", 
                                   valueText: val 
                                })
                             });
                             window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                detail: { cardId: c.id, updater: old => ({ ...old, customFields: { ...old.customFields, Active: val } }) }
                             }));
                          } catch (err) { console.error("Active save failed", err); }
                       }}
                    />
                 </div>
               </div>
            </div>

             {/* WORKFLOW TIMER (NEW) */}
            <div className="trello-section">
               <div className="trello-section-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <circle cx="12" cy="12" r="10" />
                     <path d="M12 6v6l4 2" />
                  </svg>
               </div>
               <div className="trello-section-header">
                  <h3 className="trello-h3">WorkFlow</h3>
               </div>
               
               <div className="timer-row" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  
                  {c.isArchived ? (
                     <div style={{ color: '#5e6c84', fontSize: '13px', fontWeight: 600, padding: '6px 12px', background: '#091e420f', borderRadius: '4px' }}>
                        Read-Only (Restore card to track time)
                     </div>
                  ) : (c.customFields?.WorkTimerStart && c.customFields.WorkTimerStart.includes("|")) ? (
                      <button 
                        className="btn-red" 
                        style={{ backgroundColor: '#eb5a46', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', width: '105px', textAlign: 'center' }}
                        onClick={async () => {
                           const stopTime = Date.now();
                           const rawStart = c.customFields.WorkTimerStart || "";
                           const [startTsStr, startList] = rawStart.split("|");
                           const startTime = parseFloat(startTsStr);
                           const bucketName = startList || c.boardList; // Fallback to current list

                           const sessionMins = (stopTime - startTime) / 1000 / 60;
                           
                           // Parse existing time bank
                           let savedDurations = {};
                           const rawDur = c.customFields.WorkDuration || "{}";
                           try {
                               if (!rawDur.startsWith("{")) {
                                   savedDurations = { [bucketName]: parseFloat(rawDur) || 0 };
                               } else {
                                   savedDurations = JSON.parse(rawDur);
                               }
                           } catch(e) {}

                           // Add session time to the specific bucket
                           savedDurations[bucketName] = (savedDurations[bucketName] || 0) + sessionMins;
                           savedDurations[bucketName] = parseFloat(savedDurations[bucketName].toFixed(2));
                           const newTotalStr = JSON.stringify(savedDurations);
                           
                           // Lock UI state
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkDuration", ttlMs: 30000 } }));
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkTimerStart", ttlMs: 30000 } }));

                           setTrelloCard(prev => ({
                              ...prev, customFields: { ...prev.customFields, WorkTimerStart: null, WorkDuration: newTotalStr }
                           }));

                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, WorkTimerStart: null, WorkDuration: newTotalStr } 
                              }) }
                           }));

                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST", body: JSON.stringify({ cardId: c.id, fieldName: "[SYSTEM]WorkDuration", valueText: newTotalStr })
                              });
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST", body: JSON.stringify({ cardId: c.id, fieldName: "[SYSTEM]WorkTimerStart", valueText: "" })
                              });
                           } catch(err) { console.error("WorkFlow Timer Stop Failed", err); }
                        }}
                      >
                        Stop
                      </button>
                  ) : (
                      <button 
                        className="btn-yellow"
                        style={{ backgroundColor: '#f2d600', color: '#172b4d', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', width: '105px', textAlign: 'center' }}
                        onClick={async () => {
                           // Format: timestamp|bucketName
                           const nowStr = `${Date.now()}|${c.boardList}`;
                           
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkTimerStart", ttlMs: 30000 } }));

                           setTrelloCard(prev => ({
                              ...prev, customFields: { ...prev.customFields, WorkTimerStart: nowStr }
                           }));

                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, WorkTimerStart: nowStr } 
                              }) }
                           }));
                           
                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST", body: JSON.stringify({ cardId: c.id, fieldName: "[SYSTEM]WorkTimerStart", valueText: nowStr })
                              });
                           } catch(err) { console.error("WorkFlow Timer Start Failed", err); }
                        }}
                      >
                        Start timer
                      </button>
                  )}

                  <div className="timer-display">
                     <LiveTimer 
                        startTime={!c.isArchived ? c.customFields?.WorkTimerStart : null} 
                        duration={c.customFields?.WorkDuration} 
                     />
                  </div>  
               </div>
            </div>

            {/* Activity Timer */}
            <div className="trello-section">
               <div className="trello-section-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <circle cx="12" cy="12" r="10" />
                     <polyline points="12 6 12 12 16 14" />
                  </svg>
               </div>
               <div className="trello-section-header">
                  <h3 className="trello-h3">Activity Timer</h3>
               </div>
               
               <div className="timer-row" style={{ position: 'relative' }}>
                      
                      {c.isArchived ? (
                         <div style={{ color: '#5e6c84', fontSize: '13px', fontWeight: 600, padding: '6px 12px', background: '#091e420f', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>
                            Read-Only (Restore card to track time)
                         </div>
                      ) : c.customFields?.TimerStart ? (
                          <button 
                            className="btn-red" 
                            style={{ backgroundColor: '#eb5a46', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
                            onClick={async () => {
                               const stopTime = Date.now();
                               const startTime = parseFloat(c.customFields.TimerStart);
                               const sessionMins = (stopTime - startTime) / 1000 / 60;
                               const oldDur = parseFloat(c.customFields.Duration || "0");
                               const newTotal = (oldDur + sessionMins).toFixed(2);
                               
                               window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Duration", ttlMs: 10000 } }));
                               window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "TimerStart", ttlMs: 10000 } }));

                               setTrelloCard(prev => ({
                                  ...prev, customFields: { ...prev.customFields, TimerStart: null, Duration: newTotal }
                               }));

                               await fetch("/.netlify/functions/trello-timer", {
                                  method: "POST", body: JSON.stringify({ cardId: c.id, action: "stop" })
                               });
                               
                               window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                  detail: { cardId: c.id, updater: old => ({ 
                                     ...old, customFields: { ...old.customFields, TimerStart: null, Duration: newTotal } 
                                  }) }
                               }));
                            }}
                          >
                            Stop
                          </button>
                      ) : (
                          <button 
                            className="btn-blue"
                            onClick={async () => {
                               const now = Date.now();
                               
                               window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "TimerStart", ttlMs: 10000 } }));

                               setTrelloCard(prev => ({
                                  ...prev, customFields: { ...prev.customFields, TimerStart: now }
                               }));

                               await fetch("/.netlify/functions/trello-timer", {
                                  method: "POST", body: JSON.stringify({ cardId: c.id, action: "start" })
                               });

                               window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                  detail: { cardId: c.id, updater: old => ({ 
                                     ...old, customFields: { ...old.customFields, TimerStart: now } 
                                  }) }
                               }));
                            }}
                          >
                            Start timer
                          </button>
                      )}

                      {!c.isArchived && (
                         <button 
                            className="t-btn-gray" 
                            title="Add manual time"
                            onClick={() => setShowAddTime(!showAddTime)}
                         >
                            <span>+</span> Add time
                         </button>
                      )}

                      {/* POPUP FOR MANUAL TIME */}
                      {showAddTime && !c.isArchived && (
                        <div className="label-picker-popover" style={{ width: 260, top: 45, left: 80, padding: 16, cursor: 'default' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <span style={{ fontWeight: 600, color: '#172b4d' }}>Add time tracking</span>
                              <button onClick={() => setShowAddTime(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>✕</button>
                           </div>
                           
                           <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                              <div style={{ flex: 1 }}>
                                 <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5e6c84', marginBottom: 4 }}>Hours</label>
                                 <input 
                                    type="number" min="0" 
                                    value={manualHours} 
                                    onChange={e => setManualHours(e.target.value)}
                                    style={{ width: '100%', padding: '6px 8px', borderRadius: 3, border: '2px solid #dfe1e6' }}
                                 />
                              </div>
                              <div style={{ flex: 1 }}>
                                 <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5e6c84', marginBottom: 4 }}>Minutes</label>
                                 <input 
                                    type="number" min="0" 
                                    value={manualMins} 
                                    onChange={e => setManualMins(e.target.value)}
                                    style={{ width: '100%', padding: '6px 8px', borderRadius: 3, border: '2px solid #dfe1e6' }}
                                 />
                              </div>
                           </div>

                           <button 
                              className="btn-blue" 
                              style={{ width: '100%', justifyContent: 'center' }}
                              onClick={async () => {
                                 const h = parseFloat(manualHours) || 0;
                                 const m = parseFloat(manualMins) || 0;
                                 const addedMinutes = (h * 60) + m;

                                 if (addedMinutes > 0) {
                                    const oldDur = parseFloat(c.customFields.Duration || "0");
                                    const newTotal = (oldDur + addedMinutes).toFixed(2);

                                    window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Duration", ttlMs: 10000 } }));

                                    setTrelloCard(prev => ({
                                       ...prev,
                                       customFields: { ...prev.customFields, Duration: newTotal }
                                    }));
                                    setShowAddTime(false);
                                    setManualHours("0");
                                    setManualMins("0");

                                    await fetch("/.netlify/functions/trello-set-custom-field", {
                                       method: "POST",
                                       body: JSON.stringify({ 
                                          cardId: c.id, 
                                          fieldName: "Duration", 
                                          valueText: newTotal 
                                       })
                                    });

                                    window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                       detail: { cardId: c.id, updater: old => ({ 
                                          ...old, customFields: { ...old.customFields, Duration: newTotal } 
                                       }) }
                                    }));
                                 }
                              }}
                           >
                              Add time
                           </button>
                        </div>
                      )}
                      
                      {/* LIVE COUNTER */}
                      <div className="timer-display">
                         <LiveTimer 
                            startTime={!c.isArchived ? c.customFields?.TimerStart : null} 
                            duration={c.customFields?.Duration} 
                         />
                      </div>

                      <div className="timer-estimate" style={{marginLeft:8, fontSize:12, color:'#5e6c84'}}>
                         Estimate: 0m
                      </div>
                   </div>
               
               {/* 🗑️ BANNER REMOVED */}
            </div>
{/* 📎 ATTACHMENTS RENDERER */}
            {cardAttachments.length > 0 && (
              <div className="trello-section" style={{ position: 'relative', marginTop: '24px', paddingLeft: '40px' }}>
                
                {/* 🛡️ FIX: Absolute position on the icon prevents "ttachments" text clipping */}
                <div style={{ position: 'absolute', left: '0px', top: '2px', color: '#42526e' }}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                   <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#172b4d', margin: 0 }}>Attachments</h3>
                   <button className="t-btn-gray" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={(e) => { e.stopPropagation(); setShowAddMenu(true); setAddMenuStep("attachment"); }}>Add</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                   
                   {/* 🔗 1. LINKS SECTION */}
                   {cardAttachments.filter(a => a.isUpload === false).length > 0 && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <div style={{ fontSize: '14px', fontWeight: 600, color: '#5e6c84', marginBottom: '4px' }}>Links</div>
                       {cardAttachments.filter(a => a.isUpload === false).map(att => (
                         <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#fafbfc', border: '1px solid #dfe1e6', borderRadius: '4px' }}>
                           {/* Sleek Blue Link Icon */}
                           <div style={{ color: '#0052cc', display: 'grid', placeItems: 'center', flexShrink: 0, width: '24px', height: '24px', background: '#e6fcff', borderRadius: '4px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/></svg>
                           </div>
                           <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <SmartLink url={att.url} style={{ color: '#0052cc', fontWeight: 500, fontSize: '14px', whiteSpace: 'nowrap', display: 'block' }}>
                                 {att.name || att.url}
                               </SmartLink>
                               <button onClick={async (e) => {
                                  e.stopPropagation();
                                  if(!window.confirm("Delete link?")) return;
                                  setCardAttachments(prev => prev.filter(a => a.id !== att.id));
                                  await fetch("/.netlify/functions/trello-attachments", { method: "POST", body: JSON.stringify({ action: 'delete', cardId: c.id, idAttachment: att.id }) });
                               }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#42526e', padding: '4px 8px', borderRadius: '3px', fontWeight: 'bold' }} onMouseEnter={e => e.currentTarget.style.background = '#091e4214'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  •••
                               </button>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* 📁 2. FILES SECTION */}
                   {cardAttachments.filter(a => a.isUpload !== false).length > 0 && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <div style={{ fontSize: '14px', fontWeight: 600, color: '#5e6c84', marginBottom: '4px' }}>Files</div>
                       {cardAttachments.filter(a => a.isUpload !== false).map(att => {
                          const ext = att.name ? att.name.split('.').pop().toLowerCase() : 'file';
                          
                          let iconType = 'file';
                          if (['pdf'].includes(ext)) iconType = 'pdf';
                          else if (['doc', 'docx', 'rtf', 'txt'].includes(ext)) iconType = 'doc';
                          else if (['xls', 'xlsx', 'csv'].includes(ext)) iconType = 'xls';
                          else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) iconType = 'img';

                          return (
                            <div key={att.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #091e420f' }}>
                               
                               {/* Sleek Trello File Thumbnail */}
                               {iconType === 'img' && att.previews?.length > 0 ? (
                                   <div style={{ width: '48px', height: '48px', borderRadius: '6px', border: '1px solid #dfe1e6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: '#091e420a' }} onClick={(e) => { e.stopPropagation(); setTrelloPreview(att); }}>
                                     <img src={att.previews[att.previews.length - 1].url} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                   </div>
                               ) : (
                                   <div style={{ width: '48px', height: '48px', borderRadius: '6px', border: '1px solid #dfe1e6', background: '#f4f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setTrelloPreview(att); }}>
                                     <svg viewBox="0 0 24 24" width="30" height="30" style={{ overflow: 'visible' }}>
                                       {iconType === 'pdf' && (
                                         <>
                                           <path fill="#E53935" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
                                           <path fill="rgba(255,255,255,0.3)" d="M14 2v6h6" />
                                           <text x="11.5" y="16.5" fill="white" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">PDF</text>
                                           <rect x="7" y="18" width="9" height="1" fill="white" opacity="0.8" />
                                         </>
                                       )}
                                       {iconType === 'xls' && (
                                         <>
                                           <path fill="#0F9D58" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
                                           <path fill="rgba(255,255,255,0.3)" d="M14 2v6h6" />
                                           <rect x="7" y="11" width="3.5" height="2" fill="white"/>
                                           <rect x="11.5" y="11" width="4.5" height="2" fill="white"/>
                                           <rect x="7" y="14" width="3.5" height="2" fill="white"/>
                                           <rect x="11.5" y="14" width="4.5" height="2" fill="white"/>
                                           <rect x="7" y="17" width="3.5" height="2" fill="white"/>
                                           <rect x="11.5" y="17" width="4.5" height="2" fill="white"/>
                                         </>
                                       )}
                                       {iconType === 'doc' && (
                                         <>
                                           <path fill="#1A73E8" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
                                           <path fill="rgba(255,255,255,0.3)" d="M14 2v6h6" />
                                           <rect x="7" y="11" width="10" height="1.5" fill="white"/>
                                           <rect x="7" y="14" width="10" height="1.5" fill="white"/>
                                           <rect x="7" y="17" width="6" height="1.5" fill="white"/>
                                         </>
                                       )}
                                       {iconType === 'file' && (
                                         <>
                                           <path fill="#5e6c84" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" />
                                           <path fill="rgba(255,255,255,0.3)" d="M14 2v6h6" />
                                           <rect x="7" y="12" width="10" height="1.5" fill="white"/>
                                           <rect x="7" y="16" width="6" height="1.5" fill="white"/>
                                         </>
                                       )}
                                     </svg>
                                   </div>
                               )}
                               
                               {/* Details & Action Buttons */}
                               <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                     <div style={{ fontWeight: 600, color: '#172b4d', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setTrelloPreview(att); }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                                        {att.name}
                                     </div>
                                     <div style={{ color: '#5e6c84', fontSize: '12px' }}>
                                        Added {timeAgo(att.date)}
                                     </div>
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0, paddingLeft: '8px' }}>
                                     <button onClick={(e) => { e.stopPropagation(); setTrelloPreview(att); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#42526e', padding: '6px', borderRadius: '3px' }} onMouseEnter={e => e.currentTarget.style.background = '#091e420f'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                                     </button>
                                     <button onClick={async (e) => {
                                        e.stopPropagation();
                                        if(!window.confirm(`Delete ${att.name}?`)) return;
                                        setCardAttachments(prev => prev.filter(a => a.id !== att.id));
                                        await fetch("/.netlify/functions/trello-attachments", { method: "POST", body: JSON.stringify({ action: 'delete', cardId: c.id, idAttachment: att.id }) });
                                     }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#42526e', padding: '6px 10px', borderRadius: '3px', fontWeight: 'bold' }} onMouseEnter={e => e.currentTarget.style.background = '#091e420f'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        •••
                                     </button>
                                  </div>
                               </div>
                            </div>
                          );
                       })}
                     </div>
                   )}
                </div>
              </div>
            )}
            {/* 🔴 CHECKLISTS RENDERER */}
            {checklists.map(cl => {
              const total = cl.checkItems?.length || 0;
              const checked = cl.checkItems?.filter(i => i.state === 'complete').length || 0;
              const percent = total === 0 ? 0 : Math.round((checked / total) * 100);

              return (
                <div key={cl.id} className="trello-section">
                  <div className="trello-section-icon">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                  </div>
                  <div className="trello-section-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                     <h3 className="trello-h3" style={{ fontSize: '16px', color: '#172b4d' }}>{cl.name}</h3>
                     <button className="t-btn-gray" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={async () => {
                         if(!window.confirm("Delete this checklist?")) return;
                         // Optimistic Update
                         setChecklists(prev => prev.filter(x => x.id !== cl.id));
                         await fetch("/.netlify/functions/trello-checklists", {
                             method: "POST", body: JSON.stringify({ action: 'delete_checklist', checklistId: cl.id })
                         });
                     }}>Delete</button>
                  </div>

                  {/* 🟢 PROGRESS BAR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                     <span style={{ fontSize: '12px', color: '#5e6c84', width: '32px', textAlign: 'right' }}>{percent}%</span>
                     <div style={{ flex: 1, background: '#091e4214', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, background: percent === 100 ? '#5aac44' : '#5ba4cf', height: '100%', transition: 'width 0.3s ease, background 0.3s ease' }} />
                     </div>
                  </div>

                  {/* 🟢 CHECKLIST ITEMS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', paddingLeft: '44px' }}>
                     {(cl.checkItems || []).map(item => (
                        <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }} onClick={async () => {
                            const newState = item.state === 'complete' ? 'incomplete' : 'complete';
                            
                            // Optimistic Toggle Update
                            setChecklists(prev => prev.map(x => x.id === cl.id ? { ...x, checkItems: x.checkItems.map(i => i.id === item.id ? { ...i, state: newState } : i) } : x));
                            setTrelloBuckets(prev => prev.map(b => ({ ...b, cards: b.cards.map(card => card.id === c.id ? { ...card, checkItemsChecked: Math.max(0, (card.checkItemsChecked || 0) + (newState === 'complete' ? 1 : -1)) } : card) })));
                            
                            await fetch("/.netlify/functions/trello-checklists", {
                                method: "POST", body: JSON.stringify({ action: 'toggle_item', cardId: c.id, idCheckItem: item.id, state: newState })
                            });
                        }}>
                           <input type="checkbox" checked={item.state === 'complete'} readOnly style={{ width: '16px', height: '16px', marginTop: '3px', cursor: 'pointer', accentColor: '#0079bf' }} />
                           <span style={{ flex: 1, fontSize: '14px', color: item.state === 'complete' ? '#5e6c84' : '#172b4d', textDecoration: item.state === 'complete' ? 'line-through' : 'none', transition: 'color 0.2s, text-decoration 0.2s' }}>{item.name}</span>
                        </div>
                     ))}
                  </div>

                  {/* 🟢 ADD ITEM INPUT COMPONENT */}
                  <div style={{ paddingLeft: '44px' }}>
                     <ChecklistItemInput onAdd={async (name) => {
                         const tempId = "item-" + Date.now();
                         // Optimistic Add Update
                         setChecklists(prev => prev.map(x => x.id === cl.id ? { ...x, checkItems: [...(x.checkItems||[]), { id: tempId, name, state: 'incomplete' }] } : x));
                         setTrelloBuckets(prev => prev.map(b => ({ ...b, cards: b.cards.map(card => card.id === c.id ? { ...card, checkItemsTotal: (card.checkItemsTotal || 0) + 1 } : card) })));
                         
                         const res = await fetch("/.netlify/functions/trello-checklists", {
                             method: "POST", body: JSON.stringify({ action: 'add_item', checklistId: cl.id, name })
                         });
                         const realItem = await res.json();
                         // Swap temp ID for real Trello ID
                         setChecklists(prev => prev.map(x => x.id === cl.id ? { ...x, checkItems: x.checkItems.map(i => i.id === tempId ? realItem : i) } : x));
                     }} />
                  </div>
                </div>
              );
            })}

          </div>

         {/* RIGHT COLUMN (45%) */}
         <div className="trello-sidebar-col" style={{ flex: "4.5", minWidth: 0, background: "#f4f5f7", borderLeft: "1px solid #c1c7d0", paddingTop: "20px", paddingLeft: "20px", paddingRight: "16px" }}>
  <ActivityPane
      cardId={c.id} 
      currentUserAvatarUrl={avatarFor(import.meta.env.VITE_PERSONA || "SIYA") || "https://trello-avatars.s3.amazonaws.com/cee5b736fb38fc4e0555e8491649392c/50.png"} 
      trelloMembers={trelloMembers}
      setTrelloBuckets={setTrelloBuckets}
  />
</div>

        </div>

        {/* 🟢 HIDDEN TRELLO ATTACHMENT UPLOADER */}
        <input 
          type="file" 
          ref={trelloAttachmentRef} 
          style={{ display: 'none' }} 
          onChange={async (e) => {
             const f = e.target.files?.[0];
             if (!f) return;
             if (f.size > 4.5 * 1024 * 1024) {
               alert("Netlify limit: File must be under 4.5MB.");
               return;
             }
             
             triggerSnackbar(`Uploading ${f.name} to Trello...`);
             
             const reader = new FileReader();
             reader.readAsDataURL(f);
             reader.onload = async () => {
                const base64Data = reader.result.split(",")[1];
                try {
                  const res = await fetch("/.netlify/functions/trello-upload", {
                    method: "POST",
                    body: JSON.stringify({ cardId: c.id, filename: f.name, mimeType: f.type, fileBase64: base64Data })
                  });
                  if (res.ok) {
                     const result = await res.json();
                     triggerSnackbar("Attachment saved to Trello!");
                     // ⚡ Push instantly to UI
                     setCardAttachments(prev => [...prev, result.attachment]);
                  } else {
                     triggerSnackbar("Failed to upload attachment");
                  }
                } catch(err) { console.error(err); }
             };
             e.target.value = ""; // Reset input
          }} 
        />

        {/* 🔍 TRELLO FILE PREVIEW OVERLAY */}
        {trelloPreview && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column' }} onClick={() => setTrelloPreview(null)}>
             
             {/* Top Bar */}
             <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{trelloPreview.name}</div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                   <SmartLink
                   url={trelloPreview.url}
                   style={{ color: '#fff', border: 'none', background: '#0b57d0', padding: '8px 20px', borderRadius: '4px', fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}
                  >
                 Workstation
                  </SmartLink>
                   <a href={trelloPreview.url} download target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none', background: 'rgba(255,255,255,0.2)', padding: '8px 20px', borderRadius: '4px', fontWeight: 500, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>
                     Download
                   </a>
                   <button onClick={() => setTrelloPreview(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                </div>
             </div>
             
             {/* Preview Area */}
             <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                {(() => {
                   const ext = trelloPreview.name ? trelloPreview.name.split('.').pop().toLowerCase() : '';
                   const isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
                   const isPdf = ext === 'pdf';
                   const isDocOrXls = ['doc', 'docx', 'xls', 'xlsx', 'csv'].includes(ext);
                   
                   // 1. Image: Use the Trello preview thumbnail if available
                   if (isImg && trelloPreview.previews?.length > 0) {
                       return <img src={trelloPreview.previews[trelloPreview.previews.length - 1].url} alt={trelloPreview.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />;
                   }
                   
                   // 2. Build the Proxy URL (Bypasses the forced download)
                   const proxyUrl = `/.netlify/functions/trello-download?url=${encodeURIComponent(trelloPreview.url)}&mimeType=${encodeURIComponent(trelloPreview.mimeType || '')}`;
                   
                   // 3. PDF: Display the proxied file directly inline!
                   if (isPdf) {
                       return <iframe src={proxyUrl} style={{ width: '100%', height: '100%', maxWidth: '1000px', border: 'none', background: '#fff', borderRadius: '8px' }} />;
                   }
                   
                   // 4. DOC/XLS: Hand the public proxy URL to Google Docs Viewer
                   if (isDocOrXls) {
                       const absoluteProxyUrl = `${window.location.origin}${proxyUrl}`;
                       return <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(absoluteProxyUrl)}&embedded=true`} style={{ width: '100%', height: '100%', maxWidth: '1000px', border: 'none', background: '#fff', borderRadius: '8px' }} />;
                   }
                   
                   return <div style={{ color: '#fff', fontSize: '18px', background: 'rgba(255,255,255,0.1)', padding: '24px', borderRadius: '8px' }}>Preview not available for this file type. Please download to view.</div>;
                })()}
             </div>
         </div>
        )}

      </div>
    );
  }
  return null;
}

export default TrelloApp;
