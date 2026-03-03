const { google } = require('googleapis');
const { getAccessToken } = require('./_google-creds');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  try {
    const { spaceId } = JSON.parse(event.body);
    const auth = await getAccessToken(event);
    const chat = google.chat({ version: 'v1', auth });

    // Updates the read state for the current user in the specified space
    await chat.spaces.members.patch({
      name: `${spaceId}/members/me`,
      updateMask: 'lastReadTime',
      requestBody: {
        lastReadTime: new Date().toISOString()
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("Mark read error:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};