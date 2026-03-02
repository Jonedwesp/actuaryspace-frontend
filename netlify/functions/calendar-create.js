const { google } = require('googleapis');

exports.handler = async (event, context) => {
  // 1. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 2. Parse the event data sent from your React app
    const data = JSON.parse(event.body);

    // Note: You must initialize your Google Auth client here using your existing 
    // credentials setup (the same way you do in your `calendar-events.js` file).
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN 
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // 3. Format the event for Google
    const googleEvent = {
      summary: data.summary,
      location: data.location,
      description: data.description,
      start: {
        dateTime: data.start.dateTime,
        timeZone: 'Africa/Johannesburg', // Using your local timezone
      },
      end: {
        dateTime: data.end.dateTime,
        timeZone: 'Africa/Johannesburg',
      },
      attendees: data.attendees,
      // 🟢 This block tells Google to automatically generate a Meet link!
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    // 4. Send it to Google Calendar
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1, // Required to make the Meet link work
      sendUpdates: 'all',       // Emails the guests invitations automatically
      resource: googleEvent,
    });

    // 5. Send the real event (with the Meet link and ID) back to the website
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, event: response.data }),
    };

  } catch (error) {
    console.error("Error creating event:", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};