import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    const accessToken = await getAccessToken(event);
    
    // 1. Fetch recent spaces to see where the latest activity is
    const res = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=15", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    
    // 2. Map spaces into "Notification" items that blend with emails
    const notifications = (data.spaces || []).map(s => ({
      id: s.name, 
      type: "chat", // 🛡️ THE BLEND KEY: Tells the frontend to show a chat icon
      title: s.displayName || "Direct Message",
      preview: "New message in Google Chat",
      timestamp: new Date().toISOString(), 
    }));

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({ ok: true, notifications })
    };
  } catch (err) {
    console.error("GCHAT-SYNC ERROR:", err.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ ok: false, error: err.message }) 
    };
  }
}