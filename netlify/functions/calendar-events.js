// netlify/functions/calendar-events.js
import { google } from 'googleapis';
import cookie from 'cookie';

export const handler = async function(event, context) {
  try {
    // 1. Parse cookies from the browser request
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    
    // ⚡ THE FIX: Check the cookie first, but fall back to the permanent Netlify Environment Variable
    let refreshToken = cookies.AS_GCHAT_RT || process.env.AS_GCHAT_RT; 

    if (!refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Not authenticated. Missing AS_GCHAT_RT" }) };
    }

    // Safely decode the token in case it came from a URL-encoded cookie
    try {
      refreshToken = decodeURIComponent(refreshToken);
    } catch (e) {}
    // Automatically fix the URL encoding (turns %2F back into /)
    refreshToken = decodeURIComponent(refreshToken);

    // 2. Setup the Google Auth Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // 3. Inject Siya's specific Refresh Token
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // 4. Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // 5. Fetch a larger window to populate the 30-day grid
    // 1. Catch the dynamic dates sent by the frontend's Left/Right arrows
    const timeMinParam = event.queryStringParameters?.timeMin;
    const timeMaxParam = event.queryStringParameters?.timeMax;

    // 2. Set up a safety fallback (defaults to this month -> next month)
    const now = new Date();
    const defaultTimeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultTimeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    // 3. Choose the frontend dates if they exist, otherwise use the fallback
    const finalTimeMin = timeMinParam || defaultTimeMin;
    const finalTimeMax = timeMaxParam || defaultTimeMax;

    // 4. Request the events from Google using those dynamic dates
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: finalTimeMin,
      timeMax: finalTimeMax,
      maxResults: 2500, // 👈 Increased to handle heavy historic months safely
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