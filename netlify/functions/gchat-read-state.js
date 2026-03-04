import { google } from 'googleapis';
import { getAccessToken } from './_google-creds';

export const handler = async (event) => {
  try {
    const spaceId = event.queryStringParameters.spaceId;
    if (!spaceId) return { statusCode: 400, body: JSON.stringify({ error: "Missing spaceId" }) };

    const token = await getAccessToken(event);
    const chat = google.chat({ version: 'v1', auth: token });

    // Resource name format: users/me/spaces/{space}/spaceReadState
    const res = await chat.users.spaces.getSpaceReadState({
      name: `users/me/spaces/${spaceId.replace('spaces/', '')}/spaceReadState`
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, readState: res.data })
    };
  } catch (err) {
    console.error("Fetch Read State Error:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};