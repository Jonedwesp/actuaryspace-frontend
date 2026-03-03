import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    const accessToken = await getAccessToken(event);

    // 1. Get recent spaces
    const spaceRes = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=20", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spaceData = await spaceRes.json();

    const notificationPromises = (spaceData.spaces || []).map(async (s) => {
      try {
        // 2. Fetch the user's membership to get 'lastReadTime'
        const memRes = await fetch(`https://chat.googleapis.com/v1/${s.name}/members/me`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const memData = await memRes.json();
        const lastReadTime = new Date(memData.lastReadTime || 0).getTime();

        // 3. Fetch last 3 messages
        const msgRes = await fetch(`https://chat.googleapis.com/v1/${s.name}/messages?pageSize=3`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const msgData = await msgRes.json();
        const messages = msgData.messages || [];

        // 4. Filter: Detect unread based strictly on server lastReadTime
        if (messages.length === 0) return [];

        const lastRead = new Date(memData.lastReadTime || 0).getTime();

        // 🛡️ Map messages that were created AFTER Siya last read the chat AND were NOT sent by Siya
        return messages.filter(m => {
          const createTime = new Date(m.createTime).getTime();
          const sName = (m.sender?.displayName || "").toLowerCase();
          const sEmail = (m.sender?.email || "").toLowerCase();
          const senderId = m.sender?.name || "";

          const isFromSiya = sEmail.includes("siya@") || 
                             sName.includes("siyabonga") || 
                             sName.includes("actuaryspace") ||
                             senderId === memData.name ||
                             senderId === "users/112417469383977278282";
          
          // Must be newer than server read-receipt AND not sent by Siya
          return createTime > lastRead && !isFromSiya;
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