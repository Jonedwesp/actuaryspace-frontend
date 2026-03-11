import { getAccessToken } from './_google-creds.js';

export const handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const accessToken = await getAccessToken(event);
    const data = JSON.parse(event.body);

const tz = 'Africa/Johannesburg';
    // Ensure we don't have trailing Z if the frontend sent one, and provide a strict fallback
    const rawDate = data.date && data.date !== "today" ? data.date : new Date().toISOString();
    const cleanDate = rawDate.split('T')[0];
    const startDT = data.startTime ? `${cleanDate}T${data.startTime}:00` : null;
    let endDT = data.endTime ? `${cleanDate}T${data.endTime}:00` : null;

    // 🛡️ THE FIX: Prevent mixing "dateTime" (timed) and "date" (all-day) formats
    if (startDT && !endDT) {
      // If Donna provides a start time but no end time, default to a 1-hour meeting
      const [hour, minute] = data.startTime.split(':');
      const endHour = String((parseInt(hour, 10) + 1) % 24).padStart(2, '0');
      endDT = `${cleanDate}T${endHour}:${minute || '00'}:00`;
    }

    const googleEvent = {
      summary: data.summary || 'New Meeting',
      location: data.location || '',
      description: data.description || '',
      start: startDT ? { dateTime: startDT, timeZone: tz } : { date: cleanDate },
      // Enforce symmetry: If start uses dateTime, end MUST use dateTime
      end: startDT ? { dateTime: endDT, timeZone: tz } : { date: cleanDate },
      attendees: data.guests ? data.guests.split(',').map(email => ({ email: email.trim() })) : [],
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    );

    const eventData = await response.json();
    if (!response.ok) throw new Error(eventData.error?.message || 'Calendar API error');

    if (eventData.hangoutLink) {
      const separator = eventData.hangoutLink.includes('?') ? '&' : '?';
      eventData.hangoutLink += `${separator}authuser=siyabonga@actuaryconsulting.co.za`;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, event: eventData }),
    };

  } catch (error) {
    console.error("Error creating event:", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};
