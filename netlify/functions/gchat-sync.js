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
    }, 7000);
    const spaceData = await spaceRes.json();

    const notificationPromises = (spaceData.spaces || []).map(async (s) => {
      try {
        // Fetch messages + read state in parallel; read state failure is non-fatal
        const [msgSettled, rsSettled] = await Promise.allSettled([
          fetchWithTimeout(
            `https://chat.googleapis.com/v1/${s.name}/messages?pageSize=20&orderBy=createTime+desc`,
            { headers: authHeaders }
          ).then(r => r.json()),
          fetchWithTimeout(
            `https://chat.googleapis.com/v1/users/me/${s.name}/spaceReadState`,
            { headers: authHeaders }
          ).then(r => r.json()),
        ]);
        if (msgSettled.status === "rejected") return [];
        const msgData = msgSettled.value;
        const rsData = rsSettled.status === "fulfilled" ? rsSettled.value : {};
        const messages = msgData.messages || [];
        const lastReadTime = rsData.lastReadTime ? new Date(rsData.lastReadTime) : null;

        if (messages.length === 0) return [];

        // 🛑 STRICT SIYA IDENTIFIER
        const isSiya = (m) => {
          const sName = (m.sender?.displayName || "").toLowerCase();
          const sEmail = (m.sender?.email || "").toLowerCase();
          const sId = m.sender?.name || "";

          return sEmail === "siya@actuaryspace.co.za" ||
                 sEmail === "siya@actuaryconsulting.co.za" ||
                 sEmail === "siyabonga@actuaryconsulting.co.za" ||
                 sName.includes("siyabonga") ||
                 sName.includes("actuaryspace") ||
                 sId === "users/112417469383977278282";
        };

        // 🔔 CHECK IF SIYA IS @MENTIONED in a message's annotations
        const isSiyaMentioned = (msg) => {
          return (msg.annotations || []).some(a => {
            const u = a.userMention?.user;
            if (!u) return false;
            const id = u.name || "";
            const name = (u.displayName || "").toLowerCase();
            const email = (u.email || "").toLowerCase();
            return id === "users/112417469383977278282" ||
                   id === "users/116712532865547233135" ||
                   name.includes("siyabonga") ||
                   email === "siya@actuaryspace.co.za" ||
                   email === "siyabonga@actuaryconsulting.co.za";
          });
        };

        // If spaceReadState failed, fall back to 2 days ago — never surface old messages
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const effectiveCutoff = lastReadTime || twoDaysAgo;

        const recentMessages = messages.filter(m => {
          if (isSiya(m)) return false;
          return new Date(m.createTime) > effectiveCutoff;
        }).slice(0, 10);

        if (recentMessages.length === 0) return [];

        return recentMessages.map(msg => {
          const senderId = msg.sender?.name || "";
          // For bot DMs, sender.displayName is empty — fall back to the space's displayName (e.g. "Google Drive")
          let senderName = msg.sender?.displayName || s.displayName || "Colleague";
          
          if (senderId === "users/112422887282158931745") senderName = "Repository";

          let snippet = msg.text || "";
          if (!snippet && msg.attachment?.length) snippet = "Sent an attachment";

          return {
            id: msg.name,
            spaceId: s.name,
            type: "chat",
            spaceType: s.spaceType,
            title: s.spaceType === "DIRECT_MESSAGE" ? senderName : (s.displayName || "Group Chat"),
            text: snippet,
            senderName: senderName,
            sender: { name: senderId },
            timestamp: msg.createTime,
            isMentioned: isSiyaMentioned(msg),
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