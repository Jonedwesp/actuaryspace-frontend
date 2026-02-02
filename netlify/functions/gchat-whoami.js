export async function handler(event) {
  try {
    const RT = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    if (!CLIENT_ID || !CLIENT_SECRET) return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });

    // 1) swap refresh token -> access token
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

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) return json(502, { ok: false, where: "token", tokenJson });

    const accessToken = tokenJson.access_token;

    // 2) call Chat API as whoever owns that refresh token (Siya)
    const meRes = await fetch("https://chat.googleapis.com/v1/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const meJson = await meRes.json();
    if (!meRes.ok) return json(502, { ok: false, where: "chat.users.me", meJson });

    return json(200, { ok: true, me: meJson });
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