export async function handler(event) {
  try {
    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    if (!CLIENT_ID || !CLIENT_SECRET) return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });

    // Decode if it was pasted URL-encoded
    const RT = decodeURIComponent(RT_RAW);

    // 1) Exchange refresh token -> access token
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
      return json(502, { ok: false, where: "token", status: tokenRes.status, raw: tokenText });
    }

    const accessToken = tokenJson.access_token;
    if (!accessToken) return json(502, { ok: false, where: "token", error: "No access token returned" });

    // 2) GET USER INFO (Who am I?)
    // We use the oauth2/v2/userinfo endpoint to get the numeric ID
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userJson = await userRes.json().catch(() => ({}));

    if (!userRes.ok) {
      return json(502, { ok: false, where: "userinfo", status: userRes.status, error: userJson });
    }

    // 3) Format as Google Chat Resource Name: "users/{id}"
    // This allows the frontend to strictly match "msg.sender.name"
    const chatName = `users/${userJson.id}`;

    return json(200, { 
      ok: true, 
      name: chatName, // e.g. "users/1073..."
      email: userJson.email,
      picture: userJson.picture
    });

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