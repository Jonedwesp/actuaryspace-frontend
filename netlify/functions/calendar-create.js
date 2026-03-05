import { getAccessToken } from './_google-creds.js';

export const handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const accessToken = await getAccessToken(event);
    const data = JSON.parse(event.body);

    const googleEvent = {
      summary: data.summary,
      location: data.location,
      description: data.description,
      start: data.start,
      end: data.end,
      attendees: data.attendees,
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
