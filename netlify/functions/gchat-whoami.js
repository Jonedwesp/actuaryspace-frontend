export async function handler(event) {
  try {
    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    if (!CLIENT_ID || !CLIENT_SECRET) return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });

    // Decode if it was pasted URL-encoded (e.g. 1%2F%2F...)
    const RT = decodeURIComponent(RT_RAW);

    // 1) refresh token -> access token
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

    if (!tokenRes.ok) {
      return json(502, {
        ok: false,
        where: "token",
        status: tokenRes.status,
        rawFirst200: tokenText.slice(0, 200),
        tokenJson,
      });
    }

    const accessToken = tokenJson.access_token;
    if (!accessToken) return json(502, { ok: false, where: "token", tokenJson });

    // 2) USER MODE test: list spaces (pageSize=1)
    const spacesRes = await fetch("https://chat.googleapis.com/v1/spaces?pageSize=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const spacesText = await spacesRes.text();
    let spacesJson = {};
    try { spacesJson = JSON.parse(spacesText); } catch {}

    if (!spacesRes.ok) {
      return json(502, {
        ok: false,
        where: "chat.spaces.list",
        status: spacesRes.status,
        rawFirst200: spacesText.slice(0, 200),
        spacesJson,
      });
    }

    return json(200, { ok: true, spaces: spacesJson });
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