// netlify/functions/gchat-spaces.js (NEW & IMPROVED)
export async function handler(event) {
  try {
    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    const RT = decodeURIComponent(RT_RAW);

    // 1. Refresh Token (The Engine)
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

    const tokenJson = await tokenRes.json().catch(() => ({}));
    const accessToken = tokenJson.access_token;
    if (!accessToken) return json(502, { ok: false, where: "token", tokenJson });

    // -----------------------------------------------------------------
    // ADDITION: SEARCH OR CREATE LOGIC (Fixes the ID & Amnesia)
    // -----------------------------------------------------------------
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const targetEmail = body.email;

      if (!targetEmail) return json(400, { ok: false, error: "Email required" });

      // Use spaces:setup to "Find or Create"
      const setupUrl = "https://chat.googleapis.com/v1/spaces:setup";
      const setupRes = await fetch(setupUrl, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          space: { spaceType: "DIRECT_MESSAGE", singleUserBotDm: false },
          memberships: [{
            member: { 
              name: `users/${targetEmail}`, // Use email directly thanks to our new Badge
              type: "HUMAN" 
            }
          }]
        })
      });

      const setupData = await setupRes.json();
      if (!setupRes.ok) return json(502, { ok: false, where: "setup", data: setupData });

      return json(200, { ok: true, space: setupData });
    }
    // -----------------------------------------------------------------

    // 2. List Spaces (The Sidebar)
    const url = new URL("https://chat.googleapis.com/v1/spaces");
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("fields", "spaces(name,displayName,spaceType,spaceDetails),nextPageToken");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => ({}));
    const spaces = (data.spaces || []).map((s) => ({
      id: s.name,
      displayName: s.displayName || "",
      type: s.spaceType,
      details: s.spaceDetails || null,
    }));

    return json(200, { ok: true, spaces });

  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}