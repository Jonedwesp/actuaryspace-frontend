// src/features/CalendarApp.jsx
import React from "react";
import SmartLink from "../components/SmartLink.jsx";

export function CalendarApp({
  // --- State ---
  calendarEvents, setCalendarEvents,
  calendarLoading, setCalendarLoading,
  calendarError, setCalendarError,
  calendarViewDate, setCalendarViewDate,
  isMonthView, setIsMonthView,
  selectedEvent, setSelectedEvent,
  newEventDraft, setNewEventDraft,
  eventToDelete, setEventToDelete,
  showCreateModal, setShowCreateModal,
  isLiveCallActive, setIsLiveCallActive,
  currentView, setCurrentView,
  gchatMe,
  // --- Refs ---
  notifiedEventsRef,
  // --- Handlers ---
  triggerSnackbar,
}) {
  if (currentView.app === "calendar") {

    const viewYear = calendarViewDate.getFullYear();
    const viewMonth = calendarViewDate.getMonth();
    const currentMonthName = calendarViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const today = new Date();

    // ⚡ PERFORMANCE FIX: Map events into a fast dictionary instantly
    const eventsByDate = {};
    calendarEvents.forEach(ev => {
      if (!ev || !ev.start) return;
      const startStr = ev.start.dateTime || ev.start.date;
      if (!startStr) return;
      const d = new Date(startStr);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(ev);
    });

    // 📅 1. GENERATE THE CALENDAR MATRIX (Dynamic rows to perfectly fit the month)
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    
    const totalDaysNeeded = startingDayOfWeek + daysInMonth;
    const numberOfRows = Math.ceil(totalDaysNeeded / 7);
    const totalGridCells = numberOfRows * 7;
    
    const calendarGrid = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarGrid.push({ date: new Date(viewYear, viewMonth, 1 - (startingDayOfWeek - i)), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      calendarGrid.push({ date: new Date(viewYear, viewMonth, i), isCurrentMonth: true });
    }
    const remainingDays = totalGridCells - calendarGrid.length; 
    for (let i = 1; i <= remainingDays; i++) {
      calendarGrid.push({ date: new Date(viewYear, viewMonth + 1, i), isCurrentMonth: false });
    }

return (
      <div style={{ position: "relative", padding: "24px", background: "#fff", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: "12px", border: "1px solid #8993a4", boxShadow: "0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)" }}>
        
        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", flexShrink: 0 }}>
          
          {/* 🟢 NEW: Authentic Google Calendar Create Button */}
          <button 
            onClick={() => {
              const today = new Date();
              const dateStr = today.toISOString().split('T')[0];
              setNewEventDraft({ summary: "", date: dateStr, startTime: "09:00", endTime: "10:00", guests: "", location: "", description: "" });
              setShowCreateModal(true);
            }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '6px 20px 6px 10px', marginRight: '32px',
              background: '#fff', border: 'none', borderRadius: '24px', 
              boxShadow: '0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)', 
              color: '#3c4043', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(60,64,67,0.30), 0 4px 8px 3px rgba(60,64,67,0.15)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)'}
          >
            {/* Multi-colored Google Plus Icon */}
            <svg width="32" height="32" viewBox="0 0 36 36">
              <path fill="#34A853" d="M16 16v14h4V20z"></path>
              <path fill="#4285F4" d="M30 16H20l-4 4h14z"></path>
              <path fill="#FBBC05" d="M6 16v4h10l4-4z"></path>
              <path fill="#EA4335" d="M20 16V6h-4v14z"></path>
              <path fill="none" d="M0 0h36v36H0z"></path>
            </svg>
            Create
          </button>

          {/* Month Navigation (Arrows + Text) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button 
                onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))} 
                title="Previous month"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', color: '#5f6368', display: 'grid', placeItems: 'center', transition: 'background 0.2s' }} 
                onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'} 
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <button 
                onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))} 
                title="Next month"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', color: '#5f6368', display: 'grid', placeItems: 'center', transition: 'background 0.2s' }} 
                onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'} 
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
            
            <h2 style={{ margin: 0, fontSize: "22px", color: "#3c4043", fontWeight: 400, fontFamily: "'Google Sans', Roboto, sans-serif" }}>
              {currentMonthName}
            </h2>
          </div>
        </div>

        {/* Status Indicators */}
        {calendarLoading && <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading your schedule...</div>}
        {calendarError && <div style={{ color: "#d93025", padding: "16px 0", fontSize: "14px", textAlign: "center" }}>Error: {calendarError}</div>}

        {/* Event List / Grid */}
        {!calendarLoading && !calendarError && (
          isMonthView ? (
            // 🟢 AUTHENTIC GOOGLE CALENDAR GRID VIEW
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #dadce0', borderRadius: '8px', overflowY: 'auto', overflowX: 'hidden', background: '#fff', flex: 1, minHeight: 0 }}>
              
              {/* Day Headers */}
              <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: '#dadce0', gap: '1px', borderBottom: '1px solid #dadce0' }}>
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                  <div key={day} style={{ background: '#fff', padding: '8px 0', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: '#70757a' }}>{day}</div>
                ))}
              </div>

              {/* Grid Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: 'minmax(120px, max-content)', background: '#dadce0', gap: '1px' }}>
                {calendarGrid.map((dayObj, idx) => {
                  
                  const isToday = dayObj.date.getDate() === today.getDate() && dayObj.date.getMonth() === today.getMonth() && dayObj.date.getFullYear() === today.getFullYear();
                  const isFirstDayOfMonth = dayObj.date.getDate() === 1;
                  
                  const dateKey = `${dayObj.date.getFullYear()}-${dayObj.date.getMonth()}-${dayObj.date.getDate()}`;
                  const dayEvents = eventsByDate[dateKey] || [];

                  return (
                    <div key={idx} style={{ background: '#fff', minHeight: '100px', display: 'flex', flexDirection: 'column', padding: '4px', minWidth: 0 }}>
                      
                      {/* Date Number */}
                      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                        <span style={{ 
                          display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '24px', height: '24px', 
                          borderRadius: '50%', background: isToday ? '#1a73e8' : 'transparent', 
                          color: isToday ? '#fff' : (dayObj.isCurrentMonth ? '#3c4043' : '#70757a'),
                          fontSize: '12px', fontWeight: isToday ? 600 : 400
                        }}>
                          {isFirstDayOfMonth && !isToday ? `${dayObj.date.toLocaleString('en-US', {month: 'short'})} 1` : dayObj.date.getDate()}
                        </span>
                      </div>

                      {/* Events inside the square */}
                      {/* ⚡ THE FIX 2: Removed overflowY: 'auto' from this div so the row pushes downward instead of scrolling internally */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayEvents.map(ev => {
                          const isAllDay = !ev.start.dateTime;
                          const timeStr = isAllDay ? "" : new Date(ev.start.dateTime).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
                          
                          if (isAllDay) {
                            return (
                              <div key={ev.id} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }} title={ev.summary} style={{ background: '#1a73e8', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', flexShrink: 0 }}> {/* 👈 NEW: flexShrink: 0 */}
                                {ev.summary}
                              </div>
                            );
                          } 
                          else {
                            return (
                              <div key={ev.id} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }} title={`${timeStr} ${ev.summary}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#3c4043', padding: '2px 4px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}> {/* 👈 NEW: flexShrink: 0 */}
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#039be5', flexShrink: 0 }}></div>
                                <span style={{ fontWeight: 500, flexShrink: 0 }}>{timeStr}</span>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.summary}</span>
                              </div>
                            );
                          }
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // 🟢 ORIGINAL LIST VIEW (Unchanged)
            <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", flex: 1, minHeight: 0, paddingRight: "8px" }}>
              {calendarEvents.length === 0 && !calendarLoading && !calendarError && (
                <div style={{ color: "#5f6368", padding: "32px 0", fontStyle: "italic", textAlign: "center", background: "#ffffff", borderRadius: "8px", border: "1px solid #dadce0" }}>
                  No upcoming events for the next 7 days.
                </div>
              )}
              {calendarEvents.map(ev => {
                const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date);
                const end = ev.end.dateTime ? new Date(ev.end.dateTime) : new Date(ev.end.date);
                const isAllDay = !ev.start.dateTime;

                const dayStr = start.toLocaleDateString("en-GB", { weekday: 'long', month: 'short', day: 'numeric' });
                const timeStr = isAllDay ? "All Day" : `${start.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' })}`;

                return (
                  <div 
                    key={ev.id} 
                    style={{ display: "flex", gap: "16px", marginBottom: "12px", padding: "16px", borderRadius: "8px", border: "1px solid #dadce0", background: "#ffffff", transition: "box-shadow 0.2s, border-color 0.2s" }} 
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(60,64,67,0.15)"; e.currentTarget.style.borderColor = "#c2e7ff"; }} 
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#dadce0"; }}
                  >
                    <div style={{ width: "130px", flexShrink: 0 }}>
                      <div style={{ fontWeight: 600, color: "#1a73e8", fontSize: "14px" }}>{dayStr}</div>
                      <div style={{ color: "#5f6368", fontSize: "13px", marginTop: "6px" }}>{timeStr}</div>
                    </div>
                    
                    <div style={{ width: "4px", background: "#4285F4", borderRadius: "4px" }}></div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ fontWeight: 500, color: "#202124", fontSize: "15px", marginBottom: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ev.summary || "(No title)"}
                      </div>
                      
                      {ev.location && (
                        <div style={{ fontSize: "13px", color: "#5f6368", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                          {ev.location}
                        </div>
                      )}
                      
                     {ev.hangoutLink && (
                        <SmartLink 
                          url={ev.hangoutLink}
                          setIsLiveCallActive={setIsLiveCallActive}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "4px", padding: "6px 16px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: "100px", fontSize: "13px", fontWeight: 500, transition: "background 0.2s", cursor: "pointer" }} 
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z"/></svg>
                          Join Meet
                        </SmartLink>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    );
  }
  return null;
}

export default CalendarApp;
