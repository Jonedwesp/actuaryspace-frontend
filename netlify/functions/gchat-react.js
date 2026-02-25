import { getAccessToken } from "./_google-creds.js";

const EMOJI_UNICODE = {
  "like": "👍",
  "heart": "❤️",
  "laugh": "😆"
};

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    let { messageId, type } = body; 
    
    if (!messageId || !type) {
      return json(400, { ok: false, error: "Missing messageId or type" });
    }

    // 🛡️ ID HARDENING: Google reactions require the full resource path.
    // If the frontend only sends "spaces/AAA/messages/BBB", it's fine.
    // But it MUST NOT start with a leading slash.
    messageId = messageId.replace(/^\/+/, "");

    const emojiChar = EMOJI_UNICODE[type];
    if (!emojiChar) return json(400, { ok: false, error: "Invalid reaction type" });
    // 1. Auth - This now uses the helper to find Siya's session in the cookies
    const accessToken = await getAccessToken(event);

    // 2. Add Reaction
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
    
    if (res.status === 409) {
      return json(200, { ok: true, status: "already_exists" });
    }

    if (!res.ok) {
      return json(502, { ok: false, error: "Gchat API failed", details: data });
    }

    return json(200, { ok: true, data });

  } catch (err) {
    // 🛡️ IDENTITY LOGGING: This helps us see if the token is failing in Jonathan's terminal
    console.error("GCHAT-REACT ERROR:", err.message);
    
    // If getAccessToken throws "No Refresh Token", we must send a 401
    const isAuthError = err.message.includes("No Refresh Token");
    
    return json(isAuthError ? 401 : 500, { 
      ok: false, 
      error: err.message,
      authAvailable: !!process.env.AS_GCHAT_RT // Confirms the Siya token is present
    });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}