// netlify/functions/trello-set-description.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resp(405, { ok: false, error: "Method not allowed" });
  }

  const { TRELLO_KEY, TRELLO_TOKEN } = process.env;
  if (!TRELLO_KEY || !TRELLO_TOKEN) {
    return resp(500, { ok: false, error: "Missing TRELLO_* env vars" });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const { cardId, desc = "" } = body || {};
  if (!cardId) return resp(400, { ok: false, error: "cardId required" });

  const base = "https://api.trello.com/1";
  const auth = `key=${encodeURIComponent(TRELLO_KEY)}&token=${encodeURIComponent(TRELLO_TOKEN)}`;

  try {
    const res = await fetch(`${base}/cards/${encodeURIComponent(cardId)}?${auth}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ desc }),
    });
    const json = await res.json();
    if (!res.ok) return resp(res.status, { ok: false, error: json?.message || "Trello error" });
    return resp(200, { ok: true, id: json.id, desc: json.desc });
  } catch (e) {
    return resp(500, { ok: false, error: e.message || "Failed to set description" });
  }
}

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}