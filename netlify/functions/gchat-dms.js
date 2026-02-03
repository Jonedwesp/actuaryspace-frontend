export async function handler() {
  try {
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

    const url = new URL("https://chat.googleapis.com/v1/spaces");
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("fields", "spaces(name,displayName,spaceType,spaceDetails),nextPageToken");

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}
    if (!res.ok) return json(502, { ok: false, where: "chat.spaces.list", status: res.status, rawFirst200: text.slice(0,200), data });

    const dms = (data.spaces || [])
      .filter(s => s.spaceType === "DM")
      .map(s => ({
        id: s.name,
        name: s.displayName || "DM",
        type: s.spaceType,
      }));

    return json(200, { ok: true, dms, nextPageToken: data.nextPageToken || null });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) };
}