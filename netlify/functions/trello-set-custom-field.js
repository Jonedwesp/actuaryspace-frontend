// netlify/functions/trello-set-custom-field.js  (v1 runtime, CJS)
const json = (code, body) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const key   = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    return json(500, { error: "Missing TRELLO_KEY/TRELLO_TOKEN" });
  }

  try {
    const { cardId, fieldName, valueText } = JSON.parse(event.body || "{}");
    if (!cardId || !fieldName) {
      return json(400, { error: "cardId and fieldName are required" });
    }

    // 1) card
    const cardUrl = `https://api.trello.com/1/cards/${encodeURIComponent(cardId)}?fields=id,idBoard&key=${key}&token=${token}`;
    const cardRes = await fetch(cardUrl);
    const cardJson = await cardRes.json().catch(() => null);
    if (!cardRes.ok || !cardJson?.idBoard) {
      return json(cardRes.status || 502, { error: "Failed to load card", details: cardJson });
    }
    const { idBoard } = cardJson;

    // 2) board custom fields
    const cfUrl = `https://api.trello.com/1/boards/${encodeURIComponent(idBoard)}/customFields?key=${key}&token=${token}`;
    const cfsRes = await fetch(cfUrl);
    const fields = await cfsRes.json().catch(() => null);
    if (!cfsRes.ok || !Array.isArray(fields)) {
      return json(cfsRes.status || 502, { error: "Failed to load board custom fields", details: fields });
    }

    const allowed = new Set(["Priority", "Status", "Active"]);
    if (!allowed.has(fieldName)) {
      return json(400, { error: "Unsupported fieldName" });
    }

    const field = fields.find(f => (f.name || "").trim().toLowerCase() === fieldName.toLowerCase());
    if (!field) return json(404, { error: `Custom field not found: ${fieldName}` });
    if (field.type !== "list") return json(400, { error: "Expected list(dropdown) type", got: field.type });

    // Clear value?
    if (!valueText) {
      const delUrl = `https://api.trello.com/1/cards/${encodeURIComponent(cardId)}/customField/${encodeURIComponent(field.id)}/item?key=${key}&token=${token}`;
      const delRes = await fetch(delUrl, { method: "DELETE" });
      const delJson = await delRes.json().catch(() => null);
      if (!delRes.ok) return json(delRes.status, { error: "Failed to clear", details: delJson });
      return json(200, { ok: true, cleared: true });
    }

    // Option text -> id (case-insensitive)
    const opt = (field.options || []).find(
      o => (o.value?.text || "").trim().toLowerCase() === valueText.trim().toLowerCase()
    );
    if (!opt) return json(404, { error: `Option not found for ${fieldName}: ${valueText}` });

    // 3) set value
    const putUrl = `https://api.trello.com/1/cards/${encodeURIComponent(cardId)}/customField/${encodeURIComponent(field.id)}/item?key=${key}&token=${token}`;
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idValue: opt.id }),
    });
    const putJson = await putRes.json().catch(() => null);
    if (!putRes.ok) return json(putRes.status, { error: "Failed to set field", details: putJson });

    return json(200, { ok: true, fieldId: field.id, optionId: opt.id, data: putJson });
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};
