// netlify/functions/calendar-events.js
const { google } = require('googleapis');
const cookie = require('cookie');

exports.handler = async function(event, context) {
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
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0); // End of next month

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 250, // ⚡ Increased limit to ensure we get the whole month
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