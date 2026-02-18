// netlify/functions/gchat-find-dm.js
import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { email } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Email required" }) };

    console.log(`🔎 Finding DM for: ${email}`);
    const token = await getAccessToken();

    // 1. We must use the spaces:findDirectMessage endpoint
    // Docs: https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces/findDirectMessage
    const url = `https://chat.googleapis.com/v1/spaces:findDirectMessage?name=users/${encodeURIComponent(email)}`;

    const res = await fetch(url, {
      method: "GET", // Surprisingly, this is a GET request with query params? Wait, docs say GET.
      // ACTUALLY: Check docs. It might be distinct.
      // Re-reading: It is GET https://chat.googleapis.com/v1/spaces:findDirectMessage?name=users/{user_id}
      headers: { Authorization: `Bearer ${token}` }
    });

    // If 404/400, user might not exist or be reachable
    if (!res.ok) {
      const txt = await res.text();
      console.error("❌ findDirectMessage failed:", txt);
      return { 
        statusCode: 404, 
        body: JSON.stringify({ ok: false, error: "User not found or DM not allowed." }) 
      };
    }

    const space = await res.json();
    console.log("✅ Found Space:", space.name);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true, 
        space,
        userDisplayName: email // We don't get the name back from this call easily, so fallback to email
      })
    };

  } catch (err) {
    console.error("🔥 Crash:", err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
}