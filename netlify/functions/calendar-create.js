import { google } from 'googleapis';
import cookie from 'cookie';

export const handler = async function(event, context) {
  // 1. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 2. Parse the event data sent from your React app
    const data = JSON.parse(event.body);

    // 3. EXCACT MATCH: Parse cookies for your specific auth token
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    let refreshToken = cookies.AS_GCHAT_RT || process.env.AS_GCHAT_RT; 

    if (!refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Not authenticated. Missing AS_GCHAT_RT" }) };
    }

    try { refreshToken = decodeURIComponent(refreshToken); } catch (e) {}
    refreshToken = decodeURIComponent(refreshToken);

    // 4. Setup the Google Auth Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // 5. Initialize the Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 6. Format the event for Google
    const googleEvent = {
      summary: data.summary,
      location: data.location,
      description: data.description,
      start: data.start, // Uses the +02:00 time string you generate in App.jsx
      end: data.end,
      attendees: data.attendees,
      
      // 🟢 This block tells Google to automatically generate a Meet link!
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    // 7. Send it to Google Calendar
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1, // Required to make the Meet link work
      sendUpdates: 'all',       // Emails the guests invitations automatically
      resource: googleEvent,
    });

    // 8. Send the real event (with the Meet link) back to the website
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, event: response.data }),
    };

  } catch (error) {
    console.error("Error creating event:", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};