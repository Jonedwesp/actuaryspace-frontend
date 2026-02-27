// netlify/functions/calendar-events.js
const { google } = require('googleapis');
const cookie = require('cookie');

exports.handler = async function(event, context) {
  try {
    // 1. Extract the session token just like you do in your Gmail/GChat functions
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    
    // ⚡ FIX: Match this to the exact cookie name you use in your other functions (e.g., 'googleToken' or 'session')
    const sessionStr = cookies.googleToken || cookies.session; 

    if (!sessionStr) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Not authenticated" }) };
    }

    const tokens = JSON.parse(sessionStr);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials(tokens);

    // 2. Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // 🟢 NEW: Fetch events from right now until 7 days from now
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: nextWeek.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, events: response.data.items }),
    };
  } catch (err) {
    console.error("Calendar fetch error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};