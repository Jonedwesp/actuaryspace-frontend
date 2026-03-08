export function formatLongDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatGchatTime(isoString) {
  if (!isoString) return "";
  const msgTime = new Date(isoString);
  const now = new Date();
  const time = msgTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsgDay = new Date(msgTime.getFullYear(), msgTime.getMonth(), msgTime.getDate());
  const daysDiff = Math.round((startOfToday - startOfMsgDay) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return time;
  if (daysDiff === 1) return `Yesterday ${time}`;
  if (daysDiff < 7) return `${msgTime.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
  return `${msgTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

export function formatUKTime(date) {
  // Chats (WhatsApp/Slack): HH:MM
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatUKTimeWithSeconds(date) {
  // Notifications only: HH:MM:SS
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatNotificationDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();

  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  } else {
    // For older than yesterday: "28 Feb, 14:30"
    const dateStr = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    return `${dateStr}, ${timeStr}`;
  }
}

export function formatDividerDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric' });
}

// 👇 THE FIX: Moved out of the middleContent block so the Modal at the bottom of the page can see it!
export function formatEventDateTime(ev) {
  if (!ev || !ev.start) return "";
  const startStr = ev.start.dateTime || ev.start.date;
  if (!startStr) return "";
  const start = new Date(startStr);
  const endStr = ev.end?.dateTime || ev.end?.date || startStr;
  const end = new Date(endStr);
  const isAllDay = !ev.start.dateTime;
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  try {
    let dateStr = start.toLocaleDateString('en-US', dateOptions);
    if (isAllDay) return `${dateStr} (All day)`;
    const startTimeStr = start.toLocaleTimeString('en-US', timeOptions).toLowerCase();
    const endTimeStr = end.toLocaleTimeString('en-US', timeOptions).toLowerCase();
    const formattedStart = startTimeStr.replace(/(am|pm)/, '').trim();
    return `${dateStr} · ${formattedStart} – ${endTimeStr}`;
  } catch (err) {
    return "Time details unavailable";
  }
}

export function getGchatTimezone() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
  const offset = -now.getTimezoneOffset() / 60;
  const tzDisplay = offset >= 0 ? `GMT+${offset}` : `GMT${offset}`;
  return `${timeStr} ${tzDisplay}`;
}

/* ----- Trello / business day helpers ----- */
export function pad2(n) { return String(n).padStart(2, "0"); }
export function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }

// Returns the next business day from `from`, at HH:MM
export function nextBusinessDay({ from = new Date(), minDaysAhead = 1, time = "10:00" } = {}) {
  const d = new Date(from);
  d.setDate(d.getDate() + minDaysAhead);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  const [HH, MM] = time.split(":").map(Number);
  d.setHours(HH, MM, 0, 0);
  return d;
}

export function nextTrialDate({ from = new Date(), daysAhead = 7 } = {}) {
  let d = new Date(from);
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `Trial date ${day} ${month}`;
}

export function formatDueLine(d) {
  // e.g. "Due 27 Sept 10:00"
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `Due ${day} ${month} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
