import React from "react";
import { formatEventDateTime } from "../utils/dateTime.js";
import { avatarFor } from "../utils/avatarUtils.js";
import SmartLink from "./SmartLink.jsx";

export function AppModals({
  // event details modal
  selectedEvent, setSelectedEvent, setEventToDelete, setIsLiveCallActive,
  // delete event modal
  eventToDelete, confirmDeleteEvent,
  // delete chat modal
  chatToDelete, setChatToDelete, confirmDeleteChat,
  // create event modal
  showCreateModal, setShowCreateModal,
  newEventDraft, setNewEventDraft, setCalendarEvents, triggerSnackbar,
  // snackbar
  snackbar, setSnackbar, lastAction, handleUndo,
  // delete message modal
  msgToDelete, setMsgToDelete, confirmDeleteGChatMessage,
}) {
  return (
    <>
      {selectedEvent && (
        <div className="cal-modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="cal-modal-container" onClick={(e) => e.stopPropagation()}>
            
           {/* Header with controls */}
            {/* 👇 NEW: Flexbox alignment added to header */}
            <div className="cal-modal-header" style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* 👇 NEW: Colored square moved to the title row to match Google Calendar */}
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', marginTop: '6px', marginRight: '12px', flexShrink: 0, background: selectedEvent.colorId ? undefined : '#039be5' }}></div>
              <h2 className="cal-modal-title">{selectedEvent.summary || '(No title)'}</h2>
              <div className="cal-modal-actions" style={{ display: "flex", gap: "4px" }}>
                
                {/* 👇 NEW: Delete Button Logic */}
                {(() => {
                  // Determine who is currently logged in
                  const activePersona = (import.meta.env.VITE_PERSONA || "SIYA").toUpperCase();
                  const myEmail = activePersona === "YOLANDIE" ? "yolandie@actuaryspace.co.za" : "siya@actuaryspace.co.za";
                  
                  // Check if the current user is the creator or organizer
                  const isCreator = 
                    selectedEvent.creator?.self || 
                    selectedEvent.creator?.email === myEmail || 
                    selectedEvent.organizer?.self || 
                    selectedEvent.organizer?.email === myEmail;
                  
                  // If they didn't create it, hide the delete button
                  if (!isCreator) return null;
                  
                  return (
                    <button 
                      className="cal-modal-close-btn" 
                      title="Delete event"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEventToDelete(selectedEvent);
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button> 
                  );
                })()}

                <button className="cal-modal-close-btn" onClick={() => setSelectedEvent(null)}>✕</button>
              </div>
            </div>

            <div className="cal-modal-body">
              {/* Date and Time Row */}
              <div className="cal-modal-row">
                <div className="cal-modal-icon-placeholder"></div>
                <div className="cal-modal-text">
                  <div className="cal-modal-time">{formatEventDateTime(selectedEvent)}</div>
                  {Array.isArray(selectedEvent.recurrence) && selectedEvent.recurrence.length > 0 && (
                    <div className="cal-modal-recurrence">
                      {String(selectedEvent.recurrence[0] || "").replace('RRULE:FREQ=', '').replace(';', ', ').toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())}
                    </div>
                  )}
                </div>
              </div>

              {/* Google Meet Button (if link exists) */}
              {(selectedEvent.hangoutLink || (selectedEvent.conferenceData && Array.isArray(selectedEvent.conferenceData.entryPoints))) && (
                 <div className="cal-modal-row">
                   <div className="cal-modal-icon-placeholder meet-icon">
                     {/* 👇 NEW: Authentic Google Meet Camera SVG */}
                     <svg width="24" height="24" viewBox="0 0 24 24" style={{ marginLeft: '-2px' }}>
                       <path fill="#EA4335" d="M5 6h-1a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1V6z"/>
                       <path fill="#4285F4" d="M5 6h9v12H5V6z"/>
                       <path fill="#34A853" d="M14 6h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1V6z"/>
                       <path fill="#00832D" d="M17 9.5l4-3a1 1 0 0 1 1.5.8v9.4a1 1 0 0 1-1.5.8l-4-3v-5z"/>
                     </svg>
                   </div>
                   <div>
                     {(() => {
                        const meetUrl = selectedEvent.hangoutLink || (Array.isArray(selectedEvent.conferenceData?.entryPoints) ? selectedEvent.conferenceData.entryPoints.find(ep => ep.entryPointType === 'video')?.uri : null);
                        if (!meetUrl) return null;
                        return (
                          <SmartLink
  url={meetUrl}
  className="cal-meet-btn"
  style={{ border: "none", cursor: "pointer", display: "inline-block", textDecoration: "none" }}
  setIsLiveCallActive={setIsLiveCallActive}
  setSelectedEvent={setSelectedEvent}
>
  Join with Google Meet
</SmartLink>
                        );
                     })()}
                   </div>
                 </div>
              )}

              {/* Attendees list (if any) */}
              {Array.isArray(selectedEvent.attendees) && selectedEvent.attendees.length > 0 && (
                <div className="cal-modal-row attendees-row">
                  <div className="cal-modal-icon-placeholder users-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  </div>
                  <div style={{ width: '100%' }}>
                    <div className="cal-attendees-header">
                      {selectedEvent.attendees.length} guests
                    </div>
                    <div className="cal-attendees-list">
                      {selectedEvent.attendees.map((att, index) => {
                        // 👇 NEW: Intelligently extract a name to pass to your avatar mapper
                        const displayName = att?.displayName || (att?.email ? att.email.split('@')[0] : "Unknown");
                        const avatarImg = avatarFor(displayName);

                        return (
                          <div key={index} className="cal-attendee">
                            <div className="cal-attendee-avatar" style={{
                              backgroundColor: att?.responseStatus === 'accepted' ? '#1a73e8' : '#dadce0',
                              overflow: 'hidden' // 👈 NEW: Clips images to perfect circles
                            }}>
                               {/* 👇 NEW: Render the profile picture if it exists, otherwise use initials */}
                               {avatarImg ? (
                                 <img src={avatarImg} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                               ) : (
                                 String(displayName).charAt(0).toUpperCase()
                               )}
                            </div>
                            <div className="cal-attendee-info">
                              {/* 👇 NEW: Shows proper display name instead of just emails if available */}
                              <span className="cal-attendee-email">{att?.displayName || att?.email || "Unknown"}</span>
                              {att?.organizer && <span className="cal-attendee-role">Organizer</span>}
                              {att?.responseStatus === 'needsAction' && <span className="cal-attendee-status">Pending</span>}
                              {att?.responseStatus === 'declined' && <span className="cal-attendee-status declined">Declined</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
               
              {/* Description (if exists) */}
              {selectedEvent.description && (
                <div className="cal-modal-row">
                  <div className="cal-modal-icon-placeholder desc-icon">
                    {/* 👇 NEW: Google Description Lines SVG */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/></svg>
                  </div>
                  <div className="cal-modal-description" dangerouslySetInnerHTML={{ __html: String(selectedEvent.description) }}></div>
                </div>
              )}

              {/* Calendar Name Footer */}
              <div className="cal-modal-row cal-footer-row">
                <div className="cal-modal-icon-placeholder cal-icon">
                  {/* 👇 NEW: Google Calendar SVG */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
                </div>
                <div className="cal-modal-cal-name">
                  {selectedEvent.organizer?.displayName || selectedEvent.organizer?.email || 'Calendar'}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    {/* 🔴 Custom Calendar Delete Confirmation Modal */}
      {eventToDelete && (
        <>
          <div 
            style={{ position: "fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex: 10001, background: "rgba(0,0,0,0.5)" }}
            onMouseDown={(e) => { e.stopPropagation(); setEventToDelete(null); }}
          />
          <div
            className="popup-anim-in"
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "400px",
              background: "white", padding: "24px", borderRadius: "12px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)", zIndex: 10002, border: "1px solid #dadce0",
              transformOrigin: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{fontWeight:500, marginBottom:12, fontSize:"1.2rem", color:"#202124"}}>
              Delete event?
            </div>
            <div style={{fontSize:"0.9rem", color:"#5f6368", marginBottom:"24px", lineHeight: "1.5"}}>
              Are you sure you want to delete <strong>{eventToDelete.summary || "this event"}</strong>? This action cannot be undone.
            </div>
            
           <div style={{display:"flex", justifyContent:"flex-end", gap:10}}>
               <button 
                style={{ borderRadius:4, padding: "8px 16px", color: "#5f6368", fontWeight: 500, cursor: "pointer", border: "1px solid #dadce0", background: "transparent", transition: "background 0.2s" }} 
                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f3f4"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEventToDelete(null); }}
              >
                Cancel
              </button>
             <button 
                style={{ borderRadius:4, padding: "8px 16px", background: "#d93025", color: "#fff", fontWeight: 500, cursor: "pointer", border: "none", transition: "background 0.2s" }} 
                onMouseEnter={(e) => e.currentTarget.style.background = "#c5221f"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#d93025"}
                onMouseDown={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  confirmDeleteEvent(); 
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🔴 Custom Chat Delete Confirmation Modal */}
      {chatToDelete && (
        <>
          <div 
            style={{ position: "fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex: 10001, background: "rgba(0,0,0,0.5)" }}
            onMouseDown={(e) => { e.stopPropagation(); setChatToDelete(null); }}
          />
          <div
            className="popup-anim-in"
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "400px",
              background: "white", padding: "24px", borderRadius: "12px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)", zIndex: 10002, border: "1px solid #dadce0",
              transformOrigin: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{fontWeight:500, marginBottom:12, fontSize:"1.2rem", color:"#202124"}}>
              Delete chat?
            </div>
            <div style={{fontSize:"0.9rem", color:"#5f6368", marginBottom:"24px", lineHeight: "1.5"}}>
              Are you sure you want to delete your conversation with <strong>{chatToDelete.title}</strong>? This will hide the chat and all its history.
            </div>
            
           <div style={{display:"flex", justifyContent:"flex-end", gap:10}}>
               <button 
                style={{ borderRadius:4, padding: "8px 16px", color: "#5f6368", fontWeight: 500, cursor: "pointer", border: "1px solid #dadce0", background: "transparent", transition: "background 0.2s" }} 
                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f3f4"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setChatToDelete(null); }}
              >
                Cancel
              </button>
             <button 
                style={{ borderRadius:4, padding: "8px 16px", background: "#d93025", color: "#fff", fontWeight: 500, cursor: "pointer", border: "none", transition: "background 0.2s" }} 
                onMouseEnter={(e) => e.currentTarget.style.background = "#c5221f"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#d93025"}
                onMouseDown={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  confirmDeleteChat(); 
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🟢 NEW: Google Calendar In-House Create Modal */}
      {showCreateModal && (
        <div className="cal-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="cal-modal-container" style={{ padding: '24px', width: '480px', borderRadius: '8px' }} onClick={e => e.stopPropagation()}>
            
            {/* Header / Drag Handle area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', background: '#f1f3f4', margin: '-24px -24px 20px -24px', padding: '10px 24px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
              <svg width="16" height="16" fill="#5f6368" viewBox="0 0 24 24"><path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#5f6368', padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            {/* Title Input */}
            <div style={{ marginBottom: '24px', marginLeft: '40px' }}>
              <input
                autoFocus
                type="text"
                placeholder="Add title"
                value={newEventDraft.summary}
                onChange={e => setNewEventDraft({ ...newEventDraft, summary: e.target.value })}
                style={{ width: '100%', fontSize: '22px', border: 'none', borderBottom: '2px solid #0b57d0', outline: 'none', paddingBottom: '4px', color: '#1f1f1f' }}
              />
            </div>

            {/* Date & Time Row */}
            <div className="cal-modal-row" style={{ alignItems: 'center', marginBottom: '20px' }}>
              <div className="cal-modal-icon-placeholder" style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                <svg width="20" height="20" fill="#5f6368" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                <input type="date" value={newEventDraft.date} min={new Date().toISOString().split('T')[0]} onChange={e => setNewEventDraft({ ...newEventDraft, date: e.target.value })} style={{ border: 'none', outline: 'none', fontSize: '14px', color: '#3c4043', cursor: 'pointer', background: 'transparent' }} />
                <input type="time" value={newEventDraft.startTime} onChange={e => setNewEventDraft({ ...newEventDraft, startTime: e.target.value })} style={{ border: 'none', outline: 'none', fontSize: '14px', color: '#3c4043', cursor: 'pointer', background: '#f1f3f4', padding: '4px 8px', borderRadius: '4px' }} />
                <span style={{ color: '#5f6368' }}>–</span>
                <input type="time" value={newEventDraft.endTime} onChange={e => setNewEventDraft({ ...newEventDraft, endTime: e.target.value })} style={{ border: 'none', outline: 'none', fontSize: '14px', color: '#3c4043', cursor: 'pointer', background: '#f1f3f4', padding: '4px 8px', borderRadius: '4px' }} />
              </div>
            </div>

            {/* Guests Row */}
            <div className="cal-modal-row" style={{ alignItems: 'center', marginBottom: '20px' }}>
              <div className="cal-modal-icon-placeholder" style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                <svg width="20" height="20" fill="#5f6368" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              </div>
              <input type="text" placeholder="Add guests (comma-separated emails)" value={newEventDraft.guests} onChange={e => setNewEventDraft({ ...newEventDraft, guests: e.target.value })} style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px', color: '#3c4043' }} />
            </div>

            {/* Location Row */}
            <div className="cal-modal-row" style={{ alignItems: 'center', marginBottom: '20px' }}>
              <div className="cal-modal-icon-placeholder" style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                <svg width="20" height="20" fill="#5f6368" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
              <input type="text" placeholder="Add location" value={newEventDraft.location} onChange={e => setNewEventDraft({ ...newEventDraft, location: e.target.value })} style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px', color: '#3c4043' }} />
            </div>

            {/* Description Row */}
            <div className="cal-modal-row" style={{ alignItems: 'flex-start', marginBottom: '24px' }}>
              <div className="cal-modal-icon-placeholder" style={{ width: '20px', display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                <svg width="20" height="20" fill="#5f6368" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/></svg>
              </div>
              <textarea placeholder="Add description" value={newEventDraft.description} onChange={e => setNewEventDraft({ ...newEventDraft, description: e.target.value })} style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px', color: '#3c4043', resize: 'none', minHeight: '60px', fontFamily: 'inherit', background: '#f1f3f4', padding: '8px', borderRadius: '4px' }} />
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button 
                onClick={async () => {
                  // 0. Validate: block past events
                  if (newEventDraft.date && newEventDraft.startTime) {
                    const startDt = new Date(`${newEventDraft.date}T${newEventDraft.startTime}`);
                    if (startDt < new Date()) {
                      alert("Cannot schedule a meeting in the past. Please choose a future time.");
                      return;
                    }
                  }

                  // 1. Format guests properly (Google rejects empty arrays)
                  const guestsList = newEventDraft.guests 
                    ? newEventDraft.guests.split(',').map(g => ({ email: g.trim() })).filter(g => g.email) 
                    : [];

                  // 2. Construct the payload with strict South African Timezone (+02:00)
                  const newEventData = {
                    summary: newEventDraft.summary || "(No title)",
                    location: newEventDraft.location,
                    description: newEventDraft.description,
                    start: { dateTime: `${newEventDraft.date}T${newEventDraft.startTime}:00+02:00` },
                    end: { dateTime: `${newEventDraft.date}T${newEventDraft.endTime}:00+02:00` }
                  };

                  // Only attach attendees if the user actually typed something
                  if (guestsList.length > 0) {
                    newEventData.attendees = guestsList;
                  }

                  // 3. Optimistic Update (Draw a temporary block instantly on your screen)
                  const tempId = "temp-" + Date.now();
                  setCalendarEvents(prev => [...prev, { ...newEventData, id: tempId }]);
                  setShowCreateModal(false);

                  // 4. Send to Google via your new backend
                  try {
                    const res = await fetch("/.netlify/functions/calendar-create", {
                      method: "POST",
                      credentials: "include", // 👈 THIS IS THE FIX
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(newEventData)
                    });
                    const json = await res.json();

                    if (json.ok && json.event) {
                      // Swap the temporary block with the REAL Google event (which now has the Meet link!)
                      setCalendarEvents(prev => prev.map(ev => ev.id === tempId ? json.event : ev));
                      
                      // Show success message at the bottom of the screen
                      if (typeof triggerSnackbar === 'function') {
                        triggerSnackbar("Event added to Google Calendar!");
                      }
                    } else {
                      throw new Error(json.error || "Failed to sync");
                    }
                  } catch (e) {
                    console.error("Failed to save event to server", e);
                    // Remove the fake event from the screen if the server rejected it
                    setCalendarEvents(prev => prev.filter(ev => ev.id !== tempId));
                    alert("Failed to create event on Google Calendar. Check console for details.");
                  }
                }} 
                style={{ background: '#0b57d0', color: 'white', border: 'none', borderRadius: '24px', padding: '10px 24px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0842a0'}
                onMouseLeave={e => e.currentTarget.style.background = '#0b57d0'}
              >
                Save
              </button>
            </div>
            
          </div>
        </div>
      )}

    {/* 🟢 GMAIL STYLE SNACKBAR */}
{snackbar.show && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          left: "24px",
          backgroundColor: "#323232",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          zIndex: 10000,
          boxShadow: "0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)",
          fontSize: "14px",
          minWidth: "288px"
        }}>
          <span style={{ flex: 1 }}>{snackbar.text}</span>
          <div style={{ display: "flex", gap: "16px" }}>
            {lastAction && (
              <button 
                onClick={handleUndo}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "#8ab4f8", 
                  fontWeight: 600, 
                  cursor: "pointer", 
                  textTransform: "uppercase",
                  fontSize: "14px"
                }}
              >
                Undo
              </button>
            )}
            <button 
              onClick={() => setSnackbar({ show: false, text: "" })}
              style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "18px", padding: "0 4px" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 🗑️ Delete GChat Message Confirmation Modal */}
      {msgToDelete && (
        <>
          <div
            style={{ position: "fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex: 10001, background: "rgba(0,0,0,0.5)" }}
            onMouseDown={(e) => { e.stopPropagation(); setMsgToDelete(null); }}
          />
          <div
            className="popup-anim-in"
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "380px",
              background: "white", padding: "24px", borderRadius: "12px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)", zIndex: 10002, border: "1px solid #dadce0",
              transformOrigin: "center"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{fontWeight:500, marginBottom:12, fontSize:"1.2rem", color:"#202124"}}>
              Delete message?
            </div>
            <div style={{fontSize:"0.9rem", color:"#5f6368", marginBottom:"24px", lineHeight: "1.5"}}>
              This message will be deleted for everyone in the conversation. This cannot be undone.
            </div>
            <div style={{display:"flex", justifyContent:"flex-end", gap:10}}>
              <button
                style={{ borderRadius:4, padding: "8px 16px", color: "#5f6368", fontWeight: 500, cursor: "pointer", border: "1px solid #dadce0", background: "transparent", transition: "background 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f1f3f4"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setMsgToDelete(null); }}
              >
                Cancel
              </button>
              <button
                style={{ borderRadius:4, padding: "8px 16px", background: "#d93025", color: "#fff", fontWeight: 500, cursor: "pointer", border: "none", transition: "background 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#c5221f"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#d93025"}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmDeleteGChatMessage();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default AppModals;
