// netlify/functions/trello-webhook.js
// Fires on every Trello board action.
// When [SYSTEM]WorkDuration is updated to a plain number, this function:
//   1. Calculates the session time (new total − previous total stored in WorkLog)
//   2. Applies the golden rule: credits the time to whichever list the card is in RIGHT NOW
//   3. Writes the updated per-person JSON to [SYSTEM]WorkLog

export const handler = async (event) => {
  // Trello sends a HEAD request first to verify the endpoint exists
  if (event.httpMethod === "HEAD") {
    return { statusCode: 200, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const action = payload.action;

    // Only care about custom field updates
    if (!action || action.type !== "updateCustomFieldItem") {
      return { statusCode: 200, body: "ok" };
    }

    // Only care about [SYSTEM]WorkDuration field
    const fieldName = action.data?.customField?.name || "";
    if (!fieldName.includes("WorkDuration")) {
      return { statusCode: 200, body: "ok" };
    }

    // Get the new plain number value the power-up (or website) just wrote
    const rawVal = action.data?.customFieldItem?.value?.text
                ?? action.data?.customFieldItem?.value?.number;
    const newTotal = parseFloat(rawVal);

    // Skip NaN or zero (NaN = old JSON format, zero = card was reset)
    if (isNaN(newTotal) || newTotal <= 0) {
      console.log(`[Webhook] Skipping non-numeric WorkDuration value: ${rawVal}`);
      return { statusCode: 200, body: "ok" };
    }

    const cardId = action.data?.card?.id;
    if (!cardId) return { statusCode: 200, body: "ok" };

    const key   = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    const auth  = `key=${key}&token=${token}`;

    // 1. Get the card's current list (golden rule: whoever has it NOW gets the time)
    const [cardRes, boardCFRes] = await Promise.all([
      fetch(`https://api.trello.com/1/cards/${cardId}?fields=idList&${auth}`),
      fetch(`https://api.trello.com/1/boards/${payload.model?.id}/customFields?${auth}`)
    ]);
    const cardData  = await cardRes.json();
    const boardCFs  = await boardCFRes.json();

    const listRes  = await fetch(`https://api.trello.com/1/lists/${cardData.idList}?fields=name&${auth}`);
    const listData = await listRes.json();
    const listName = listData.name;

    // 2. Find the [SYSTEM]WorkLog field on the board
    const workLogField = Array.isArray(boardCFs)
      ? boardCFs.find(f => f.name.includes("WorkLog"))
      : null;

    if (!workLogField) {
      console.error("[Webhook] [SYSTEM]WorkLog custom field not found on board. Create it first.");
      return { statusCode: 200, body: "ok" };
    }

    // 3. Read the card's current WorkLog value
    const cardCFRes  = await fetch(`https://api.trello.com/1/cards/${cardId}/customFieldItems?${auth}`);
    const cardCFData = await cardCFRes.json();
    const workLogItem = Array.isArray(cardCFData)
      ? cardCFData.find(item => item.idCustomField === workLogField.id)
      : null;

    let workLog = {};
    try {
      workLog = JSON.parse(workLogItem?.value?.text || "{}");
    } catch (e) {
      workLog = {};
    }

    // 4. Calculate this session's time
    const prevTotal   = parseFloat(workLog._total) || 0;
    const sessionMins = newTotal - prevTotal;

    if (sessionMins < 0.1) {
      // Less than 6 seconds — skip (duplicate event or correction)
      console.log(`[Webhook] Skipping tiny session (${sessionMins.toFixed(2)} mins) for card ${cardId}`);
      return { statusCode: 200, body: "ok" };
    }

    // 5. Golden rule: add session to whoever's list the card is in right now
    workLog[listName]  = parseFloat(((workLog[listName] || 0) + sessionMins).toFixed(2));
    workLog._total     = newTotal;

    // 6. Write updated WorkLog back to Trello
    const updateRes = await fetch(
      `https://api.trello.com/1/cards/${cardId}/customField/${workLogField.id}/item?${auth}`,
      {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ value: { text: JSON.stringify(workLog) } })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error("[Webhook] Failed to write WorkLog:", err);
    } else {
      console.log(`[Webhook] +${sessionMins.toFixed(2)} mins → "${listName}" on card ${cardId}`);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error("[Webhook] Crash:", err.message);
    // Always return 200 so Trello doesn't keep retrying
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
