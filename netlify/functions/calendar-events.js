import { getAccessToken } from './_google-creds.js';

export const handler = async function(event) {
  try {
    const accessToken = await getAccessToken(event);

    const timeMinParam = event.queryStringParameters?.timeMin;
    const timeMaxParam = event.queryStringParameters?.timeMax;

    const now = new Date();
    const defaultTimeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultTimeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const finalTimeMin = timeMinParam || defaultTimeMin;
    const finalTimeMax = timeMaxParam || defaultTimeMax;

    const params = new URLSearchParams({
      timeMin: finalTimeMin,
      timeMax: finalTimeMax,
      maxResults: '2500',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Calendar API error');

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, events: data.items }),
    };
  } catch (err) {
    console.error("Calendar fetch error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
