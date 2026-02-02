export async function handler(event) {
  try {
    // IMPORTANT: env values sometimes get pasted URL-encoded (like 1%2F%2F...)
    // This safely turns it back into 1//...
    const RT_RAW = process.env.AS_GCHAT_RT || "";
    const RT = safeDecode(RT_RAW).trim();

    const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
    const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

    if (!RT) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env", hint: "Set raw refresh token (starts with 1//...), not URL-encoded." });
    if (!CLIENT_ID || !CLIENT_SECRET) return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });

    // 1) swap refresh token -> access token
    const tokenUrl = "https://oauth2.googleapis.com/token";

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: RT,
        grant_type: "refresh_token",
      }),
    });

    const tokenRaw = await tokenRes.text();

    let tokenJson = null;
    try {
      tokenJson = JSON.parse(tokenRaw);
    } catch {
      return json(502, {
        ok: false,
        where: "token_parse",
        status: tokenRes.status,
        tokenUrl,
        rawFirst200: tokenRaw.slice(0, 200),
      });
    }

    if (!tokenRes.ok) {
      return json(502, {
        ok: false,
        where: "token",
        status: tokenRes.status,
        tokenJson,
        hint:
          tokenJson?.error === "invalid_grant"
            ? "invalid_grant usually means: refresh token revoked/expired, wrong OAuth client (ID/secret mismatch), or refresh token is still encoded."
            : undefined,
      });
    }

    const accessToken = tokenJson.access_token;
    if (!accessToken) return json(502, { ok: false, where: "token", tokenJson, error: "No access_token returned" });

    // 2) call Chat API as whoever owns that refresh token (Siya)
    const meRes = await fetch("https://chat.googleapis.com/v1/spaces", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const meRaw = await meRes.text();

    let meJson = null;
    try {
      meJson = JSON.parse(meRaw);
    } catch {
      return json(502, {
        ok: false,
        where: "chat.users.me_parse",
        status: meRes.status,
        rawFirst200: meRaw.slice(0, 200),
      });
    }

    if (!meRes.ok) return json(502, { ok: false, where: "chat.users.me", status: meRes.status, meJson });

    return json(200, { ok: true, me: meJson });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

function safeDecode(s) {
  try {
    // only decode if it looks encoded
    return /%[0-9A-Fa-f]{2}/.test(s) ? decodeURIComponent(s) : s;
  } catch {
    return s;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}