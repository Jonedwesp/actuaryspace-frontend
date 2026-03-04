import { getAccessToken } from "./_google-creds.js";

function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export async function handler(event) {
  try {
    const accessToken = await getAccessToken(event);
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const spaceRes = await fetchWithTimeout("https://chat.googleapis.com/v1/spaces?pageSize=40", {
      headers: authHeaders
    }, 20000);
    const spaceData = await spaceRes.json();

    const notificationPromises = (spaceData.spaces || []).map(async (s) => {
      try {
        const [memRes, msgRes] = await Promise.all([
          fetchWithTimeout(`https://chat.googleapis.com/v1/${s.name}/members/me`, { headers: authHeaders }),
          fetchWithTimeout(`https://chat.googleapis.com/v1/${s.name}/messages?pageSize=100`, { headers: authHeaders }),
        ]);
        const memData = await memRes.json();
        const msgData = await msgRes.json();
        const messages = msgData.messages || [];

        if (messages.length === 0) return [];

        // 🛑 STRICT SIYA IDENTIFIER: Catches all variants of Siya's identity
        const isSiya = (m) => {
          const sName = (m.sender?.displayName || "").toLowerCase();
          const sEmail = (m.sender?.email || "").toLowerCase();
          const sId = m.sender?.name || ""; // e.g. "users/112417469383977278282"
          
          // Extracts the user ID from Siya's own membership name (e.g., spaces/X/members/Y -> Y)
          const myIdFromServer = memData.name ? memData.name.split('/').pop() : "";

          return sEmail === "siya@actuaryspace.co.za" || 
                 sEmail === "siya@actuaryconsulting.co.za" ||
                 sEmail === "siyabonga@actuaryconsulting.co.za" ||
                 sName.includes("siyabonga") || 
                 sName.includes("actuaryspace") ||
                 sId === "users/112417469383977278282" ||
                 (myIdFromServer && sId.includes(myIdFromServer));
        };

        // 🚀 THE "API BLIND" FIX: 
        // We send the 10 most recent messages that aren't from Siya.
        // We let the frontend filter these against the "unreadGchatSpaces" state.
        const recentMessages = messages.filter(m => !isSiya(m)).slice(0, 10);

        if (recentMessages.length === 0) return [];

        return recentMessages.map(msg => {
          const senderId = msg.sender?.name || "";
          let senderName = msg.sender?.displayName || "Colleague";
          
          if (senderId === "users/112422887282158931745") senderName = "Repository";

          let snippet = msg.text || "";
          if (!snippet && msg.attachment?.length) snippet = "Sent an attachment";

          return {
            id: msg.name, 
            spaceId: s.name,
            type: "chat",
            title: s.type === "DIRECT_MESSAGE" ? senderName : (s.displayName || "Group Chat"),
            text: snippet,
            senderName: senderName,
            timestamp: msg.createTime,
          };
        });
      } catch (e) {
        return null;
      }
    });

    const notifications = (await Promise.all(notificationPromises))
      .filter(Boolean)
      .flat();

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