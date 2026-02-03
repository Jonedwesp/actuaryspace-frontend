export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { ok: false, error: "POST only" });

    const body = safeJson(event.body);
    const space = body?.space;
    const text = body?.text;

    if (!space) return json(400, { ok: false, error: "Missing body.space (e.g. spaces/XXXX)" });
    if (!text || !String(text).trim()) return json(400, { ok: false, error: "Missing body.text" });

    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    if (!CLIENT_ID || !CLIENT_SECRET) return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });

    const RT = decodeURIComponent(RT_RAW);

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
    if (!tokenRes.ok) return json(502, { ok: false, where: "token", status: tokenRes.status, rawFirst200: tokenText.slice(0,200), tokenJson });

    const accessToken = tokenJson.access_token;
    if (!accessToken) return json(502, { ok: false, where: "token", tokenJson });

    const res = await fetch(`https://chat.googleapis.com/v1/${space}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ text: String(text) }),
    });

    const respText = await res.text();
    let respJson = {};
    try { respJson = JSON.parse(respText); } catch {}
    if (!res.ok) return json(502, { ok: false, where: "chat.messages.create", status: res.status, rawFirst200: respText.slice(0,200), respJson });

    return json(200, { ok: true, message: respJson });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) };
}