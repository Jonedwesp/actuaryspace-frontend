import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    const accessToken = await getAccessToken(event);

    const spaceRes = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=40", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spaceData = await spaceRes.json();

    const notificationPromises = (spaceData.spaces || []).map(async (s) => {
      try {
        const memRes = await fetch(`https://chat.googleapis.com/v1/${s.name}/members/me`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const memData = await memRes.json();
        
        const msgRes = await fetch(`https://chat.googleapis.com/v1/${s.name}/messages?pageSize=100`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
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

        // Find Siya's absolute most recent message to act as a local "read receipt"
        const myLastMessage = messages.find(m => isSiya(m));
        const myLastMsgTime = myLastMessage ? new Date(myLastMessage.createTime).getTime() : 0;
        const serverLastRead = new Date(memData.lastReadTime || 0).getTime();

        // Truth: The thread is only unread if messages exist AFTER both Siya's read receipt AND his last sent message
        const effectiveReadTime = Math.max(serverLastRead, myLastMsgTime);

        return messages.filter(m => {
          // 🛑 TOTAL BLOCK: If Siya is the sender, this message is NEVER unread
          if (isSiya(m)) return false;

          const createTime = new Date(m.createTime).getTime();
          // Only messages from OTHERS that appeared after Siya's last interaction are unread
          return createTime > effectiveReadTime;
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