import { getAccessToken } from "./_google-creds.js";

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

    // ✅ HARDEN SPACE INPUT
    space = space.replace(/^\/+/, "");
    space = space.replace(/\/messages\/?$/i, "");
    if (!space.startsWith("spaces/")) space = `spaces/${space}`;

    // 1) Get Access Token (Uses Siya's identity from cookies)
    const accessToken = await getAccessToken(event);

    // 2) Send Message
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
    console.error("GCHAT-SEND ERROR:", err.message);
    const isAuthError = err.message.includes("No Refresh Token");
    return json(isAuthError ? 401 : 500, { ok: false, error: err.message });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache"
    },
    body: JSON.stringify(body),
  };
}