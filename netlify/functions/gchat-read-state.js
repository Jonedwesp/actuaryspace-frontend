import { getAccessToken } from './_google-creds.js';

export const handler = async (event) => {
  try {
    const spaceId = event.queryStringParameters.spaceId;
    if (!spaceId) return { statusCode: 400, body: JSON.stringify({ error: "Missing spaceId" }) };

    const token = await getAccessToken(event);
    const cleanSpaceId = spaceId.replace('spaces/', '');

    const response = await fetch(
      `https://chat.googleapis.com/v1/users/me/spaces/${cleanSpaceId}/spaceReadState`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const readState = await response.json();
    if (!response.ok) throw new Error(readState.error?.message || 'Read state API error');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, readState })
    };
  } catch (err) {
    console.error("Fetch Read State Error:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
