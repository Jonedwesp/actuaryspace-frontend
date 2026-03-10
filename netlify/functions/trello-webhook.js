export const handler = async (event) => {
  if (event.httpMethod === "HEAD") return { statusCode: 200, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const payload = JSON.parse(event.body || "{}");
    const action = payload.action;

    if (!action || action.type !== "updateCustomFieldItem") return { statusCode: 200, body: "ok" };

    const fieldName = action.data?.customField?.name || "";
    if (!fieldName.includes("WorkDuration")) return { statusCode: 200, body: "ok" };

    const rawVal = action.data?.customFieldItem?.value?.text ?? action.data?.customFieldItem?.value?.number;
    const newTotal = parseFloat(rawVal);

    if (isNaN(newTotal) || newTotal <= 0) return { statusCode: 200, body: "ok" };

    const cardId = action.data?.card?.id;
    if (!cardId) return { statusCode: 200, body: "ok" };

    const key   = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    const auth  = `key=${key}&token=${token}`;

    // 1. Fetch EVERYTHING first before making any destructive changes
    const cardCFRes  = await fetch(`https://api.trello.com/1/cards/${cardId}/customFieldItems?${auth}`);
    const cardCFData = await cardCFRes.json();
    
    const boardCFRes = await fetch(`https://api.trello.com/1/boards/${payload.model?.id}/customFields?${auth}`);
    const boardCFs   = await boardCFRes.json();

    const workLogField    = boardCFs.find(f => f.name.includes("WorkLog"));
    const timerStartField = boardCFs.find(f => f.name.includes("WorkTimerStart"));

    // 2. Safely read WorkLog
    const workLogItem = cardCFData.find(item => item.idCustomField === workLogField?.id);
    let workLog = {};
    try { workLog = JSON.parse(workLogItem?.value?.text || "{}"); } catch (e) {}

    // 3. Extract EXACT ownership from the start timer string (e.g., "1741268572000|Siya - Review")
    const startItem = cardCFData.find(item => item.idCustomField === timerStartField?.id);
    const startString = startItem?.value?.text || "";
    
    let listName = startString.includes("|") ? startString.split("|")[1] : null;

    // Fallback: If timer string is corrupt, grab the card's current list
    if (!listName) {
        const listRes = await fetch(`https://api.trello.com/1/cards/${cardId}?fields=idList&${auth}`);
        const listData = await listRes.json();
        const listObj = await fetch(`https://api.trello.com/1/lists/${listData.idList}?fields=name&${auth}`).then(r => r.json());
        listName = listObj.name || "UNK";
    }

    const bucketKey = listName.substring(0, 3).toUpperCase(); 

    // 4. Calculate this session's exact delta
    const prevTotal = parseFloat(workLog._total) || 0;
    let sessionMins = newTotal - prevTotal;
    
    // Stop duplicate hooks from writing math errors
    if (sessionMins <= 0) return { statusCode: 200, body: "ok" };

    // 5. Update JSON Log permanently
    workLog[bucketKey] = parseFloat(((workLog[bucketKey] || 0) + sessionMins).toFixed(2));
    workLog._total     = newTotal;

    // 6. Save WorkLog AND Clear Start Timer safely
    if (workLogField) {
        await fetch(`https://api.trello.com/1/cards/${cardId}/customField/${workLogField.id}/item?${auth}`, {
            method:  "PUT",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ value: { text: JSON.stringify(workLog) } })
        });
    }
    
    if (timerStartField && startString !== "") {
        // ⚡ THE FIX: Trello requires an empty text object to clear a text field properly without crashing
        await fetch(`https://api.trello.com/1/cards/${cardId}/customField/${timerStartField.id}/item?${auth}`, {
            method:  "PUT",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ value: { text: "" } })
        });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error("[Webhook] Crash:", err.message);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};