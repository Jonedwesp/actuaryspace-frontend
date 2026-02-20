// netlify/functions/trello-set-custom-field.js
const json = (code, body) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  try {
    const { cardId, fieldName, valueText } = JSON.parse(event.body || "{}");
    if (!cardId || !fieldName) return json(400, { error: "cardId and fieldName required" });

    // 1. Get Card & Board ID
    const cardRes = await fetch(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`);
    const cardJson = await cardRes.json();
    if (!cardJson.idBoard) return json(404, { error: "Card not found" });

    // 2. Get Custom Fields
    const cfRes = await fetch(`https://api.trello.com/1/boards/${cardJson.idBoard}/customFields?key=${key}&token=${token}`);
    const fields = await cfRes.json();

    // 3. Find the Field (Case Insensitive)
    const field = fields.find(f => f.name.trim().toLowerCase() === fieldName.trim().toLowerCase());
    if (!field) return json(404, { error: `Field '${fieldName}' not found on board.` });

    // 4. Handle "Clear" (No value)
    if (!valueText) {
      await fetch(`https://api.trello.com/1/cards/${cardId}/customField/${field.id}/item?key=${key}&token=${token}`, { method: "DELETE" });
      return json(200, { ok: true, cleared: true });
    }

    // 5. Handle Dropdown Options (Fuzzy Match)
    if (field.type === "list") {
      const target = valueText.trim().toLowerCase();
      
      // Try exact match first, then fuzzy
      const option = field.options.find(o => {
         const optTxt = (o.value.text || "").trim().toLowerCase();
         return optTxt === target || optTxt.includes(target) || target.includes(optTxt);
      });

      if (!option) {
         // Log valid options for debugging
         const validOptions = field.options.map(o => o.value.text).join(", ");
         return json(400, { error: `Option '${valueText}' not found. Valid options: ${validOptions}` });
      }

      await fetch(`https://api.trello.com/1/cards/${cardId}/customField/${field.id}/item?key=${key}&token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idValue: option.id }),
      });
      return json(200, { ok: true, matched: option.value.text });
    } 
    // 6. Handle Text/Number Fields
    else {
      // Ensure timestamps and durations are sent as actual numbers to prevent Trello corruption
      const finalValue = field.type === "number" ? parseFloat(valueText) : valueText;
      
      await fetch(`https://api.trello.com/1/cards/${cardId}/customField/${field.id}/item?key=${key}&token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: { [field.type]: finalValue } }),
      });
      return json(200, { ok: true });
    }

  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};