import React, { useState, useEffect } from "react";
import SmartLink from "./SmartLink.jsx";
import { avatarFor } from "../utils/avatarUtils.js";

// Helper to turn raw Trello action data into human readable text
const formatTrelloAction = (action) => {
  const actor = action.memberCreator?.fullName || "Someone";
  const data = action.data;
  const type = action.type;

  switch (type) {
    case "commentCard":
      return { text: `${actor} commented`, comment: data.text, type: "comment" };
    case "updateCard":
      if (data.listBefore && data.listAfter) {
        return { text: `${actor} moved this card from ${data.listBefore.name} to ${data.listAfter.name}`, type: "system" };
      }
      if (data.old && data.old.closed === false && data.card?.closed === true) {
        return { text: `${actor} archived this card`, type: "system" };
      }
      if (data.old && data.old.closed === true && data.card?.closed === false) {
        return { text: `${actor} sent this card to the board`, type: "system" };
      }
      return null; 
    case "createCard":
    case "copyCard":
       if(data.list) {
          return { text: `${actor} added this card to ${data.list.name}`, type: "creation" };
       }
       return { text: `${actor} created this card`, type: "creation" };
    default:
      return null;
  }
};

// Helper for relative time (e.g., "17 minutes ago")
export const timeAgo = (dateParam) => {
  if (!dateParam) return null;
  const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
  const today = new Date();
  const seconds = Math.round((today - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

// 👇 UPGRADED: Parses Links [Text](url), @mentions, and newlines
function formatTrelloComment(text) {
  if (!text) return "";
  
  const regex = /(\[[^\]]+\]\(https?:\/\/[^)]+\)|@[\w.-]+)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('[') && part.includes('](')) {
      const linkMatch = part.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (linkMatch) {
  return (
    <SmartLink 
      key={`link-${index}`} 
      url={linkMatch[2]} 
      style={{ color: '#0052cc', textDecoration: 'underline', wordBreak: 'break-word', fontWeight: 500 }}
    >
      {linkMatch[1]}
    </SmartLink>
  );
}
    }

    // 2. ✨ Render @Mentions (The Trello Pill Effect)
    if (part.startsWith('@')) {
      return (
        <span 
          key={`mention-${index}`} 
          style={{
            // 🎨 COLOR MATCH: Trello's native grey pill style
            backgroundColor: '#091e420f', // Light grey background
            color: '#172b4d',           // Dark grey text
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: '13px',
            display: 'inline-block',
            margin: '0 2px'
          }}
        >
          {part}
        </span>
      );
    }

    return part.split('\n').map((line, i, arr) => (
      <React.Fragment key={`text-${index}-${i}`}>
        {line}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

// ---------------- NEW ACTIVITY COMPONENT ----------------
const ActivityPane = React.memo(function ActivityPane({ cardId, currentUserAvatarUrl, trelloMembers, setTrelloBuckets }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Main comment input states
  const [commentInput, setCommentInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [mentionQuery, setMentionQuery] = useState(null);

  // 🟢 NEW: States for managing inline editing
  // Which comment ID is currently being edited? (null if none)
  const [editingActionId, setEditingActionId] = useState(null); 
  // The temporary text in the edit textarea
  const [editText, setEditText] = useState(""); 
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // 🟢 NEW: State to control how many activities are shown (starts at 20)
  const [visibleCount, setVisibleCount] = useState(20);

  // Define the current user name to identify "my comments"
  const CURRENT_USER_NAME = "Siyabonga Nono";

  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    setVisibleCount(20); // 🟢 NEW: Reset to 20 whenever a new card is opened
    
    fetch(`/.netlify/functions/trello-actions?cardId=${cardId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
           // ⚡ FIX: Removed .slice(0, 20) so the app keeps all history in memory
           const formatted = data.map(a => ({ ...a, formatted: formatTrelloAction(a) })).filter(a => a.formatted);
           setActions(formatted);
        }
      })
      .catch(err => console.error("Failed to load activity", err))
      .finally(() => setLoading(false));
  }, [cardId]);

  const handleCommentChange = (e) => {
    const val = e.target.value;
    setCommentInput(val);
    
    const cursorStart = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorStart);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (fullName) => {
    const ta = document.getElementById("trello-comment-textarea");
    if (!ta) return;
    
    const cursorStart = ta.selectionStart;
    const textBeforeCursor = commentInput.slice(0, cursorStart);
    const textAfterCursor = commentInput.slice(cursorStart);
    
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbolIndex !== -1) {
        const newTextBefore = commentInput.slice(0, lastAtSymbolIndex);
        const mentionText = `@${fullName.replace(/\s+/g, '')} `; 
        setCommentInput(newTextBefore + mentionText + textAfterCursor);
        setMentionQuery(null);
        
        setTimeout(() => {
            ta.focus();
            const newPos = newTextBefore.length + mentionText.length;
            ta.setSelectionRange(newPos, newPos);
        }, 0);
    }
  };

  const handleSaveComment = async () => {
    if (!commentInput.trim() || isSaving) return;
    setIsSaving(true);
    const textToSave = commentInput.trim();

    const optimisticAction = {
      id: "opt-" + Date.now(),
      date: new Date().toISOString(),
      // Uses the predefined constant name
      memberCreator: { fullName: CURRENT_USER_NAME, avatarHash: null }, 
      formatted: { text: `${CURRENT_USER_NAME} commented`, comment: textToSave, type: "comment" }
    };
    setActions(prev => [optimisticAction, ...prev]);
    
    setCommentInput("");
    setIsFocused(false);

    try {
      const res = await fetch("/.netlify/functions/trello-add-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, text: textToSave })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save comment");
      setTrelloBuckets(prev => prev.map(b => ({ ...b, cards: b.cards.map(card => card.id === cardId ? { ...card, commentCount: (card.commentCount || 0) + 1 } : card) })));
    } catch(err) {
      console.error("Comment save error:", err);
      alert("Failed to save comment to Trello.");
      setActions(prev => prev.filter(a => a.id !== optimisticAction.id));
      setCommentInput(textToSave);
      setIsFocused(true);
    } finally {
      setIsSaving(false);
    }
  };

  // 🟢 NEW: Handle saving an edited comment
  const handleSaveEdit = async (actionId) => {
      if(!editText.trim() || isSavingEdit) return;
      setIsSavingEdit(true);

      // 1. Optimistic Update
      setActions(prevActions => 
        prevActions.map(act => 
            act.id === actionId 
            ? { 
                ...act, 
                // ⚡ FIX: Inject dateLastEdited so the "(edited)" badge appears instantly
                data: { ...(act.data || {}), dateLastEdited: new Date().toISOString() },
                formatted: { ...act.formatted, comment: editText.trim() } 
              }
            : act
        )
      );
      setEditingActionId(null); // Exit edit mode immediately against optimistic state

      try {
          // 2. API Call
          const res = await fetch("/.netlify/functions/trello-edit-comment", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ actionId, text: editText.trim() })
          });
          if(!res.ok) throw new Error("Failed to edit comment");
      } catch(err) {
          console.error(err);
          alert("Failed to edit comment on Trello. Reverting.");
          // Revert needed here in a real app, for prototype we rely on refresh
      } finally {
          setIsSavingEdit(false);
      }
  };

  const styles = {
    container: { marginTop: '0px', color: '#172b4d' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    headerTitle: { fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' },
    hideBtn: { background: '#091e420f', border: 'none', padding: '6px 12px', borderRadius: '3px', fontWeight: '500', cursor: 'pointer', color: '#172b4d' },
    commentSection: { display: 'flex', gap: '12px', marginBottom: '24px' },
    avatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#dfe1e6', backgroundSize: 'cover', flexShrink: 0 },
    inputWrapper: { flexGrow: 1 },
    commentInput: { 
        width: '100%', borderRadius: '3px', border: isFocused ? '2px solid #0079bf' : '1px solid #dfe1e6', 
        padding: '8px 12px', fontSize: '14px', transition: 'all 0.2s', outline: 'none', minHeight: isFocused ? '80px' : 'auto', resize: 'none',
        boxShadow: isFocused ? '0 0 0 2px #ffffff, 0 0 0 4px #0079bf' : 'none', fontFamily: "inherit",
        backgroundColor: '#ffffff'
    },
    controls: { marginTop: '8px', display: 'flex', gap: '8px' },
    saveBtn: { background: '#0079bf', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '3px', fontWeight: '500', cursor: 'pointer' },
    discardBtn: { background: 'transparent', color: '#42526e', border: 'none', padding: '6px 12px', borderRadius: '3px', fontWeight: '500', cursor: 'pointer' },
    activityList: { display: 'flex', flexDirection: 'column', gap: '16px' },
    actItem: { display: 'flex', gap: '12px', fontSize: '14px' },
    actContent: { display: 'flex', flexDirection: 'column', flex: 1 },
    actText: { fontWeight: '400', color: '#172b4d' },
    actMeta: { fontSize: '12px', color: '#5e6c84', marginTop: '2px' },
    commentBubble: { background: 'white', padding: '8px 12px', borderRadius: '3px', border: '1px solid #dfe1e6', marginTop: '6px', boxShadow: '0 1px 1px #091e4240', color: '#172b4d', width: 'fit-content', maxWidth: '100%' },
    actionLinks: { display: 'flex', gap: '12px', fontSize: '12px', color: '#5e6c84', marginTop: '4px', marginLeft: '4px' },
    link: { cursor: 'pointer', textDecoration: 'none' }
  };

  const getAvatar = (hash) => hash ? `https://trello-avatars.s3.amazonaws.com/${hash}/50.png` : null;

  const filteredActions = actions.filter(act => {
    if (showDetails) return true;
    return act.formatted.type === "comment" || act.formatted.type === "creation";
  });

  // 🟢 NEW: Slice the array based on the visibleCount limit and check if there are more
  const displayedActions = filteredActions.slice(0, visibleCount);
  const hasMore = filteredActions.length > visibleCount;

  const filteredMembers = trelloMembers ? trelloMembers.filter(m => 
    m.fullName.toLowerCase().includes(mentionQuery || '') || 
    (m.username && m.username.toLowerCase().includes(mentionQuery || ''))
  ) : [];

  return (
    <div style={styles.container}>
      {/* --- Header --- */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="#42526e"><path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3ZM11 17H7V15H11V17ZM17 13H7V11H17V13ZM17 9H7V7H17V9Z"></path></svg>
           Comments and activity
        </div>
        <button 
           style={styles.hideBtn} 
           onClick={() => setShowDetails(!showDetails)}
           onMouseEnter={e => e.currentTarget.style.background = '#091e4214'}
           onMouseLeave={e => e.currentTarget.style.background = '#091e420f'}
        >
           {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* --- Main Comment Input Box --- */}
      <div style={styles.commentSection}>
        <div style={{...styles.avatar, backgroundImage: `url(${currentUserAvatarUrl})`}}></div>
        <div style={styles.inputWrapper}>
             <div style={{ position: 'relative' }}>
                 <textarea 
                    id="trello-comment-textarea"
                    style={{...styles.commentInput, minHeight: isFocused ? '80px' : '40px'}}
                    placeholder="Write a comment..."
                    value={commentInput}
                    onChange={handleCommentChange}
                    onFocus={() => setIsFocused(true)}
                 />
                 {/* @Mention Dropdown */}
                 {mentionQuery !== null && filteredMembers.length > 0 && (
                     <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#fff', border: '1px solid #dfe1e6', borderRadius: '3px', boxShadow: '0 8px 16px -4px rgba(9,30,66,0.25)', width: '250px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, marginBottom: '4px' }}>
                         {filteredMembers.map(m => (
                             <div key={m.id} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#172b4d', fontSize: '13px' }} onMouseEnter={e => e.currentTarget.style.background = '#091e420f'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => insertMention(m.fullName)}>
                                 {(avatarFor(m.fullName) || m.avatarUrl) ? <img src={avatarFor(m.fullName) || (m.avatarUrl.endsWith('.png') ? m.avatarUrl : m.avatarUrl + '/50.png')} alt="" style={{width: 24, height: 24, borderRadius: '50%'}} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div style={{width: 24, height: 24, borderRadius: '50%', background: '#dfe1e6', display: 'grid', placeItems: 'center', fontWeight: 600}}>{m.fullName[0]}</div>}
                                 <span style={{ fontWeight: 500 }}>{m.fullName}</span>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
             {isFocused && (
                <div style={styles.controls}>
                    <button style={{...styles.saveBtn, opacity: (!commentInput.trim() || isSaving) ? 0.5 : 1}} disabled={!commentInput.trim() || isSaving} onClick={handleSaveComment}>
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button style={styles.discardBtn} onClick={() => { setIsFocused(false); setCommentInput(""); setMentionQuery(null); }}>Discard</button>
                </div>
             )}
        </div>
      </div>

      {/* --- Activity List --- */}
      <div style={styles.activityList}>
        {loading && <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading activity...</div>}
        {/* ⚡ FIX: Use the sliced 'displayedActions' array */}
        {!loading && displayedActions.map(act => {
          // Resolve Actor Name
          let rawName = act.memberCreator?.fullName || "Someone";
          if (rawName === "Jonathan") rawName = "Jonathan Espanol";
          else if (trelloMembers && trelloMembers.length > 0) {
              const matched = trelloMembers.find(m => m.id === act.memberCreator?.id);
              if (matched) rawName = matched.fullName;
          }
          const actorName = rawName;

          // 🟢 NEW: Check if this comment belongs to the current user (Siyabonga Nono)
          // We check the name, or if it's a temporary "optimistic" comment we just created.
          const isMyComment = actorName === CURRENT_USER_NAME || act.id.startsWith("opt-");
          
          // 🟢 NEW: Check if this specific comment is currently being edited
          const isEditingThis = editingActionId === act.id;

          const actionText = act.formatted.text.startsWith(act.memberCreator?.fullName) ? act.formatted.text.slice((act.memberCreator?.fullName).length) : ` ${act.formatted.text}`;
          const resolvedAvatar = avatarFor(actorName) || getAvatar(act.memberCreator?.avatarHash);

          return (
            <div key={act.id} style={styles.actItem}>
              <div style={{ ...styles.avatar, backgroundImage: resolvedAvatar ? `url(${resolvedAvatar})` : 'none', display: 'grid', placeItems: 'center', color: '#172b4d', fontWeight: 600, fontSize: '14px' }}>
                  {!resolvedAvatar && actorName.charAt(0).toUpperCase()}
              </div>
              <div style={styles.actContent}>
                 <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, color: '#172b4d', fontSize: '14px' }}>
                      {actorName}
                    </span>
                    
                    {/* 🟢 NEW: Hide the "commented" text, but keep action text for moves/creation */}
                    {act.formatted.type !== "comment" && (
                      <span style={{ color: '#172b4d', fontSize: '14px' }}>
                        {actionText}
                      </span>
                    )}

                    {/* 🟢 NEW: Time is moved next to the name. Blue/underlined for comments to match Trello */}
                    <span style={{ 
                        fontSize: '12px', 
                        color: act.formatted.type === 'comment' ? '#0052cc' : '#5e6c84', 
                        textDecoration: act.formatted.type === 'comment' ? 'underline' : 'none' 
                    }}>
                      {timeAgo(act.date)}
                    </span>

                    {/* 🟢 NEW: Display (edited) if a dateLastEdited flag exists */}
                    {act.formatted.type === "comment" && (act.data?.dateLastEdited || act.dateLastEdited) && (
                      <span style={{ fontSize: '12px', color: '#5e6c84' }}>
                        (edited)
                      </span>
                    )}
                 </div>
                 
                 {/* 🟢 NEW: Conditional Rendering: Show Edit Textarea OR Comment Bubble */}
                 {act.formatted.comment && (
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                         
                         {isEditingThis ? (
                             /* --- EDIT MODE --- */
                             <div style={{ marginTop: '6px' }}>
                                 <textarea 
                                     autoFocus
                                     style={{...styles.commentInput, minHeight: '80px', boxShadow: '0 0 0 2px #ffffff, 0 0 0 2px #0079bf'}}
                                     value={editText}
                                     onChange={(e) => setEditText(e.target.value)}
                                 />
                                 <div style={styles.controls}>
                                     <button 
                                        style={{...styles.saveBtn, opacity: isSavingEdit ? 0.5 : 1}} 
                                        disabled={isSavingEdit}
                                        onClick={() => handleSaveEdit(act.id)}
                                     >
                                        {isSavingEdit ? "Saving..." : "Save"}
                                     </button>
                                     <button 
                                        style={styles.discardBtn} 
                                        disabled={isSavingEdit}
                                        onClick={() => { setEditingActionId(null); setEditText(""); }}
                                     >
                                        Cancel
                                     </button>
                                 </div>
                             </div>
                         ) : (
                             /* --- NORMAL VIEW MODE --- */
                             <>
                                 <div style={styles.commentBubble}>
                                    {formatTrelloComment(act.formatted.comment)}
                                 </div>
                                 
                                 {/* Action Links (Reply, Edit, Delete) */}
                                 <div style={styles.actionLinks}>
                                     <span style={styles.link} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'} onClick={() => {
                                            const mention = `@${actorName.replace(/\s+/g, '')} `;
                                            setCommentInput(prev => prev ? `${prev} ${mention}` : mention);
                                            setIsFocused(true);
                                            setTimeout(() => { const ta = document.getElementById("trello-comment-textarea"); if (ta) ta.focus(); }, 0);
                                        }}>Reply</span>
                                     
                                     {/* 🟢 NEW: Only show Edit/Delete if it's MY comment */}
                                     {isMyComment && (
                                        <>
                                             <span style={styles.link} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'} onClick={() => {
                                                // Start Editing mode
                                                setEditingActionId(act.id);
                                                setEditText(act.formatted.comment);
                                             }}>Edit</span>
                                             
                                             <span style={styles.link} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'} onClick={async () => {
                                                 if(!window.confirm("Delete this comment?")) return;
                                                 setActions(prev => prev.filter(a => a.id !== act.id));
                                                 try { await fetch("/.netlify/functions/trello-delete-comment", { method: "POST", body: JSON.stringify({ actionId: act.id }) }); } catch(err) { console.error("Delete failed", err); }
                                             }}>Delete</span>
                                        </>
                                     )}
                                 </div>
                             </>
                         )}
                     </div>
                 )}
              </div>
            </div>
          );
        })}
        
        {/* 🟢 NEW: "View more activity" button */}
        {!loading && hasMore && (
           <button 
             onClick={() => setVisibleCount(prev => prev + 20)}
             style={{
                background: 'transparent', 
                border: 'none', 
                color: '#5e6c84', 
                fontWeight: 500, 
                cursor: 'pointer', 
                padding: '8px 12px', 
                textDecoration: 'underline', 
                alignSelf: 'flex-start',
                marginTop: '8px'
             }}
             onMouseEnter={e => e.currentTarget.style.color = '#172b4d'}
             onMouseLeave={e => e.currentTarget.style.color = '#5e6c84'}
           >
             View more activity...
           </button>
        )}
        
      </div>
    </div>
  );
});

export default ActivityPane;
