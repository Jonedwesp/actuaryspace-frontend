import { useState, useRef, useEffect } from "react";

function getCalendarIcon(day) {
  const d = day ?? new Date().getDate();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="white" stroke="%23dadce0" stroke-width="1"/><rect x="0" y="0" width="24" height="8" rx="3" fill="%231a73e8"/><rect x="0" y="5" width="24" height="3" fill="%231a73e8"/><text x="12" y="19.5" text-anchor="middle" font-size="10" font-weight="700" fill="%23202124" font-family="Arial,sans-serif">${d}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function useCalendar({ currentView, setNotifications, triggerSnackbar, reportSystemError, clearSystemError }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [newEventDraft, setNewEventDraft] = useState({ summary: "", date: "", startTime: "", endTime: "", guests: "", location: "", description: "" });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [isMonthView, setIsMonthView] = useState(true);
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const notifiedEventsRef = useRef(new Set());

  useEffect(() => {
    calendarError ? reportSystemError("Calendar", calendarError) : clearSystemError("Calendar");
  }, [calendarError]);

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    const eventId = eventToDelete.id;
    setCalendarEvents(prev => prev.filter(ev => ev.id !== eventId));
    setNotifications(prev => prev.filter(n => n.id !== `cal-${eventId}`));
    setSelectedEvent(null);
    setEventToDelete(null);
    triggerSnackbar("Event deleted");
    try {
      await fetch("/.netlify/functions/calendar-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
    } catch (err) {
      console.error("Failed to delete event", err);
    }
  };

  // Meet reminder poller (every 60s)
  useEffect(() => {
    const checkUpcomingMeets = async () => {
      try {
        const now = new Date();
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

        clearSystemError("Calendar Sync");
        const res = await fetch(`/.netlify/functions/calendar-events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { credentials: "include" });
        const json = await res.json();
        if (!json.ok || !json.events) return;

        json.events.forEach(ev => {
          const startStr = ev.start?.dateTime;
          if (!startStr) return;

          const startTime = new Date(startStr).getTime();
          const timeDiffMins = (startTime - Date.now()) / (1000 * 60);

          if (timeDiffMins <= 0) {
            setNotifications(prev => prev.filter(n => n.id !== `cal-${ev.id}`));
            return;
          }

          if (notifiedEventsRef.current.has(ev.id)) return;

          const hasMeet = ev.hangoutLink || (ev.conferenceData && ev.conferenceData.entryPoints?.some(ep => ep.entryPointType === 'video'));

          if (hasMeet && timeDiffMins > 0 && timeDiffMins <= 30) {
            notifiedEventsRef.current.add(ev.id);
            window.dispatchEvent(new CustomEvent("notify", {
              detail: {
                id: `cal-${ev.id}`,
                text: `Meeting in ${Math.round(timeDiffMins)} mins: ${ev.summary || "Event"}`,
                alt: "Calendar",
                icon: getCalendarIcon(new Date(ev.start?.dateTime || ev.start?.date).getDate()),
                calendarEventData: ev,
                timestamp: new Date().toISOString()
              }
            }));
          }
        });
      } catch (err) {
        console.error("Calendar reminder poll failed", err);
        reportSystemError("Calendar Sync", err.message);
      }
    };

    checkUpcomingMeets();
    const intId = setInterval(checkUpcomingMeets, 60000);
    return () => clearInterval(intId);
  }, []);

  // Calendar events loader
  useEffect(() => {
    if (currentView.app !== "calendar") return;

    let cancelled = false;
    setCalendarLoading(true);
    setCalendarError("");

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const timeMin = new Date(year, month - 1, 1).toISOString();
    const timeMax = new Date(year, month + 2, 0).toISOString();

    fetch(`/.netlify/functions/calendar-events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.ok) {
          setCalendarEvents(data.events || []);
        } else {
          setCalendarError(data.error || "Failed to load events");
        }
      })
      .catch(err => {
        if (!cancelled) setCalendarError(err.message);
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentView.app, calendarViewDate]);

  return {
    selectedEvent, setSelectedEvent,
    showCreateModal, setShowCreateModal,
    eventToDelete, setEventToDelete,
    newEventDraft, setNewEventDraft,
    calendarEvents, setCalendarEvents,
    calendarLoading, setCalendarLoading,
    calendarError, setCalendarError,
    isMonthView, setIsMonthView,
    calendarViewDate, setCalendarViewDate,
    confirmDeleteEvent,
    notifiedEventsRef,
  };
}
