// netlify/functions/gchat-react.js
import dotenv from "dotenv";
dotenv.config();

const EMOJI_UNICODE = {
  "like": "👍",
  "heart": "❤️",
  "laugh": "😆"
};

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const { messageId, type } = JSON.parse(event.body); // type = "like" | "heart"
    
    if (!messageId || !type) {
      return json(400, { ok: false, error: "Missing messageId or type" });
    }

    const emojiChar = EMOJI_UNICODE[type];
    if (!emojiChar) return json(400, { ok: false, error: "Invalid reaction type" });

    const RT = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    // 1. Auth
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: RT,
        grant_type: "refresh_token",
      }),
    });
    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    // 2. Add Reaction
    // API: POST /v1/{name=spaces/*/messages/*}/reactions
    const url = `https://chat.googleapis.com/v1/${messageId}/reactions`;
    
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        emoji: { unicode: emojiChar }
      })
    });

    const data = await res.json();
    
    // 409 Conflict means "You already reacted with this emoji"
    // We treat this as success because the UI state is already correct.
    if (res.status === 409) {
      return json(200, { ok: true, status: "already_exists" });
    }

    if (!res.ok) {
      return json(502, { ok: false, error: "Gchat API failed", details: data });
    }

    return json(200, { ok: true, data });

  } catch (err) {
    return json(500, { ok: false, error: String(err) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}