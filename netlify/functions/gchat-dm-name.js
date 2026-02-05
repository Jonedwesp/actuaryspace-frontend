// netlify/functions/gchat-dm-name.js
export async function handler(event) {
  try {
    const space = event.queryStringParameters?.space;
    if (!space) return json(400, { ok: false, error: "Missing ?space=spaces/XXXX" });

    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing AS_GCHAT_RT in env" });
    if (!CLIENT_ID || !CLIENT_SECRET)
      return json(400, { ok: false, error: "Missing GOOGLE_CLIENT_ID/SECRET in env" });

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

    if (!tokenRes.ok || !tokenJson.access_token) {
      return json(502, {
        ok: false,
        where: "token",
        status: tokenRes.status,
        rawFirst200: tokenText.slice(0, 200),
        tokenJson,
      });
    }

    const accessToken = tokenJson.access_token;

    const meRes = await fetch("https://chat.googleapis.com/v1/users/me?fields=name", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meJson = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !meJson?.name) {
      return json(502, { ok: false, where: "users/me", meJson });
    }

    const membersUrl = new URL(`https://chat.googleapis.com/v1/${space}/members`);
    membersUrl.searchParams.set("pageSize", "100");
    membersUrl.searchParams.set("fields", "members(member(name,type,displayName))");

    const memRes = await fetch(membersUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const memJson = await memRes.json().catch(() => ({}));
    if (!memRes.ok) {
      return json(502, { ok: false, where: "members.list", memJson });
    }

    const members = Array.isArray(memJson.members) ? memJson.members : [];
    const other = members.find(
      (m) => m?.member?.type === "HUMAN" && m.member?.name !== meJson.name
    );

    const label = other?.member?.displayName || null;

    return json(200, {
      ok: true,
      names: { [space]: label }
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