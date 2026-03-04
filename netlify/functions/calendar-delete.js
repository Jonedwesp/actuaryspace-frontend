import { google } from 'googleapis';
import cookie from 'cookie';

export const handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 1. Parse cookies from the browser request (Exactly like your events file)
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    let refreshToken = cookies.AS_GCHAT_RT || process.env.AS_GCHAT_RT; 

    if (!refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Not authenticated. Missing AS_GCHAT_RT" }) };
    }

    // Safely decode the token
    try { refreshToken = decodeURIComponent(refreshToken); } catch (e) {}
    refreshToken = decodeURIComponent(refreshToken);

    // 2. Setup the Google Auth Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // 3. Inject Siya/Yolandie's specific Refresh Token
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // 4. Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 5. Get the event ID sent from the frontend button
    const { eventId } = JSON.parse(event.body);

    if (!eventId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing event ID" }) };
    }

    // 6. Delete the event via the official Google library
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };

  } catch (err) {
    console.error("Calendar delete error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};