export async function handler(event) {
  try {
    const { space } = event.queryStringParameters || {};
    if (!space) return json(400, { ok: false, error: "Missing ?space=spaces/XXXX" });

    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    if (!CLIENT_ID || !CLIENT_SECRET)
      return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });

    const RT = decodeURIComponent(RT_RAW);

    // 1) refresh -> access
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: RT,
        grant_type: "refresh_token",
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenJson = {};
    try { tokenJson = JSON.parse(tokenText); } catch {}

    if (!tokenRes.ok || !tokenJson.access_token) {
      return json(502, { ok: false, error: "Auth failed", details: tokenText });
    }
    const accessToken = tokenJson.access_token;

    // 2) List messages
    const url = new URL(`https://chat.googleapis.com/v1/${space}/messages`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "createTime desc");
    // Removed 'fields' constraint to ensure we get all data
    
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const rawText = await res.text();
    let data = {};
    try { data = JSON.parse(rawText); } catch {}

    if (!res.ok) {
      return json(502, { ok: false, error: "List failed", details: rawText });
    }
    const msgs = Array.isArray(data.messages) ? data.messages : [];

    // 3) Collect IDs
    const userIds = Array.from(
      new Set(
        msgs
          .map((m) => m?.sender?.name)
          .filter((u) => typeof u === "string" && u.startsWith("users/"))
      )
    );

    // 4) Resolve Names via MEMBERSHIP (Valid Scope!)
    // We transform "users/123" -> "spaces/AAA/members/users/123"
    const nameMap = {};
    await Promise.all(
      userIds.map(async (u) => {
        try {
          // 👇 NEW STRATEGY: Fetch Member, not User
          const memberName = `${space}/members/${u}`; 
          const uRes = await fetch(
            `https://chat.googleapis.com/v1/${memberName}?fields=member(displayName,email)`, 
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          
          if (uRes.ok) {
            const uJson = await uRes.json();
            // The membership object has a 'member' field inside
            const profile = uJson.member || {};
            
            let niceName = profile.displayName;
            if (!niceName && profile.email) niceName = profile.email.split("@")[0];
            if (niceName) nameMap[u] = niceName;
          }
        } catch (err) {
          // ignore
        }
      })
    );

    // 5) Shape response
    const messages = msgs.map((m) => {
      const senderId = m?.sender?.name || null;
      const apiDisplay = m?.sender?.displayName;
      const apiEmail = m?.sender?.email;
      
      let resolved = "Unknown";
      
      if (senderId && nameMap[senderId]) resolved = nameMap[senderId];
      else if (apiDisplay) resolved = apiDisplay;
      else if (apiEmail) resolved = apiEmail.split("@")[0];
      else if (senderId) resolved = `User ...${senderId.slice(-4)}`;

      return {
        id: m.name,
        text: m.text || "",
        createTime: m.createTime || null,
        sender: {
          id: senderId,
          name: senderId,
          displayName: resolved,
          type: m?.sender?.type,
        },
      };
    });

    return json(200, { ok: true, messages, nextPageToken: data.nextPageToken });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}