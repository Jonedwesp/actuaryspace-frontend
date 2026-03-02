import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    const accessToken = await getAccessToken(event);

    // 1. Get recent spaces
    const spaceRes = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=20", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spaceData = await spaceRes.json();

    // 2. Fetch latest messages (increased buffer)
    const notificationPromises = (spaceData.spaces || []).map(async (s) => {
      try {
        // Fetch last 3 messages to catch rapid-fire unread texts
        const msgRes = await fetch(`https://chat.googleapis.com/v1/${s.name}/messages?pageSize=3`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const msgData = await msgRes.json();
        const messages = msgData.messages || [];

        // Map all incoming unread messages in this space
        return messages.filter(m => {
          const sName = (m.sender?.displayName || "").toLowerCase();
          const sEmail = (m.sender?.email || "").toLowerCase();
          return !(sEmail.includes("siya@") || sName.includes("siyabonga"));
        }).map(m => {
          const senderName = m.sender?.displayName || "Colleague";
          let snippet = m.text || "";
          if (!snippet && m.attachment?.length) snippet = "Sent an attachment";

          return {
            id: m.name, 
            spaceId: s.name,
            type: "chat",
            title: s.type === "DIRECT_MESSAGE" ? senderName : (s.displayName || "Group Chat"),
            text: snippet,
            senderName: senderName,
            timestamp: m.createTime,
          };
        });
      } catch (e) {
        return null;
      }
    });

    // Flatten the array of arrays into a single list of unread messages
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