import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    const accessToken = await getAccessToken(event);

    // 1. Get recent spaces
    const spaceRes = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=10", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spaceData = await spaceRes.json();

    // 2. Fetch the latest message for each space to get real sender info
    const notificationPromises = (spaceData.spaces || []).map(async (s) => {
      try {
        const msgRes = await fetch(`https://chat.googleapis.com/v1/${s.name}/messages?pageSize=1`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const msgData = await msgRes.json();
        const latestMsg = msgData.messages?.[0];

        if (!latestMsg) return null;

        const senderName = latestMsg.sender?.displayName || "Someone";
        let snippet = latestMsg.text || "";
        if (!snippet && latestMsg.attachment?.length) snippet = "Sent an attachment";

        return {
          id: latestMsg.name,
          spaceId: s.name,
          type: "chat",
          title: s.type === "DIRECT_MESSAGE" ? senderName : s.displayName,
          text: `${senderName}: ${snippet}`,
          timestamp: latestMsg.createTime,
        };
      } catch (e) {
        return null;
      }
    });

    const notifications = (await Promise.all(notificationPromises)).filter(Boolean);

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