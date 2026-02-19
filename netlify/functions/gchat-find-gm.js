// netlify/functions/gchat-find-gm.js
import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { email } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Email required" }) };

    const token = await getAccessToken();

    // Direct approach using spaces:setup with email alias
    // This removes the need for the People API lookup step which often requires extra directory permissions
    console.log(`🔎 Attempting setup for: ${email}`);
    const setupUrl = `https://chat.googleapis.com/v1/spaces:setup`;
    const res = await fetch(setupUrl, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        space: { spaceType: "DIRECT_MESSAGE" },
        membership: [ { member: { name: `users/${email}` } } ]
      })
    });

    const setupData = await res.json();

    if (res.ok) {
      console.log("✅ Session Ready via email alias");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: true, 
          space: setupData, 
          userDisplayName: email 
        })
      };
    }

    // Capture and return the specific Google error message to help diagnose permissions
    console.error("❌ spaces:setup failed:", setupData);
    const googleError = setupData.error?.message || "Google Chat could not find this user.";
    
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: `Google API Error: ${googleError}` 
      })
    };

  } catch (err) {
    console.error("🔥 Crash:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
}