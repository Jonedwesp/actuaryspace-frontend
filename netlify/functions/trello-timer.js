exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, action } = JSON.parse(event.body || "{}");
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  try {
    // 1. Get Board ID
    const cardRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`, "GET");
    const boardId = cardRes.data.idBoard;

    // 2. Find Custom Fields (Explicitly prioritize "WorkFlow" fields)
    const cfRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/customFields?key=${key}&token=${token}`, "GET");
    
    // We strictly look for the WorkFlow versions first
    const startField = cfRes.data.find(f => f.name === "WorkTimerStart") || cfRes.data.find(f => f.name === "TimerStart");
    const durationField = cfRes.data.find(f => f.name === "WorkDuration") || cfRes.data.find(f => f.name === "Duration");

    if (!startField || !durationField) {
      return { statusCode: 400, body: JSON.stringify({ error: "Required timer fields not found on this board." }) };
    }

    // 3. Get Current Values from Card
    const cardCFRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customFieldItems?key=${key}&token=${token}`, "GET");
    
    const startItem = cardCFRes.data.find(f => f.idCustomField === startField.id);
    const durationItem = cardCFRes.data.find(f => f.idCustomField === durationField.id);

    const currentStartStr = startItem?.value?.text || startItem?.value?.number;
    const currentDurationStr = durationItem?.value?.text || durationItem?.value?.number || "0";
    
    const currentStart = currentStartStr ? parseFloat(currentStartStr) : null;
    const currentDuration = parseFloat(currentDurationStr);

    // --- STOP TIMER ---
    if (action === "stop") {
      if (!currentStart) return { statusCode: 200, body: JSON.stringify({ message: "Timer was not running" }) };

      const now = Date.now();
      const elapsedMinutes = (now - currentStart) / 1000 / 60;
      const newTotal = (currentDuration + Math.max(0, elapsedMinutes)).toFixed(2);

      const durPayload = durationField.type === "number" ? { value: { number: newTotal } } : { value: { text: String(newTotal) } };
      const startPayload = { value: "" }; 

      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${durationField.id}/item?key=${key}&token=${token}`, "PUT", durPayload);
      await trelloRequest(`https://api.trello.com/1/customField/${startField.id}/item/card/${cardId}`, "PUT", startPayload); // Updated endpoint for clearing
      
      return { statusCode: 200, body: JSON.stringify({ ok: true, active: false, total: newTotal }) };
    } 
    
    // --- START TIMER ---
    else if (action === "start") {
      const nowStr = Date.now().toString();
      const startPayload = startField.type === "number" ? { value: { number: nowStr } } : { value: { text: nowStr } };

      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${startField.id}/item?key=${key}&token=${token}`, "PUT", startPayload);
      
      return { statusCode: 200, body: JSON.stringify({ ok: true, active: true, start: nowStr }) };
    }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};