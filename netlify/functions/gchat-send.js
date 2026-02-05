export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "POST only" });
    }

    const body = safeJson(event.body);
    let space = String(body?.space || "").trim();
    const text = String(body?.text || "").trim();

    if (!space) return json(400, { ok: false, error: "Missing body.space (e.g. spaces/XXXX)" });
    if (!text) return json(400, { ok: false, error: "Missing body.text" });

    // ✅ HARDEN SPACE INPUT:
    // - remove leading slashes
    // - if they accidentally passed "spaces/.../messages", strip "/messages"
    // - ensure it starts with "spaces/"
    space = space.replace(/^\/+/, "");
    space = space.replace(/\/messages\/?$/i, "");
    if (!space.startsWith("spaces/")) space = `spaces/${space}`;

    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });
    }

    const RT = decodeURIComponent(RT_RAW);

    // 1) exchange refresh token -> access token
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
    if (!accessToken) {
      return json(502, { ok: false, where: "token", tokenJson });
    }

    // 2) send message
    const url = `https://chat.googleapis.com/v1/${encodeURI(space)}/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const respText = await res.text();
    let respJson = {};
    try { respJson = JSON.parse(respText); } catch {}

    if (!res.ok) {
      // ✅ include the exact URL we called so you can see instantly if it's malformed
      return json(502, {
        ok: false,
        where: "chat.messages.create",
        url,
        space,
        status: res.status,
        rawFirst200: respText.slice(0, 200),
        respJson,
      });
    }

    return json(200, { ok: true, message: respJson, url, space });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}