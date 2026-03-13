const https = require('https');

// 🚀 ARCHITECT'S ENGINE: Native https helper to prevent "trelloRequest is not defined"
const trelloRequest = (url, method, body = null) => {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(url, opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, action } = JSON.parse(event.body || "{}");
  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!cardId || cardId === "undefined") {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid Card ID" }) };
  }

  try {
    // 1. Get Board ID
    const cardRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`, "GET");
    if (cardRes.status !== 200) throw new Error("Card not found");
    const boardId = cardRes.data.idBoard;

    // 2. Find Custom Fields
    const cfRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/customFields?key=${key}&token=${token}`, "GET");
    
    // 🎯 FIX: Hybrid Matching to catch "TimerStart" OR "[SYSTEM] WorkTimerStart"
    const startField = cfRes.data.find(f => f.name.includes("TimerStart"));
    const durationField = cfRes.data.find(f => f.name.includes("Duration"));

    if (!startField || !durationField) {
      return { statusCode: 400, body: JSON.stringify({ error: "Timer fields not found on board." }) };
    }

    // 3. Get Current Values from Card
    const cardCFRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customFieldItems?key=${key}&token=${token}`, "GET");
    
    const startItem = cardCFRes.data.find(f => f.idCustomField === startField.id);
    const durationItem = cardCFRes.data.find(f => f.idCustomField === durationField.id);

    const currentStartStr = startItem?.value?.text || startItem?.value?.number;
    // 🎯 Handle the timestamp|listName format if present
    const cleanStart = currentStartStr?.split('|')[0];
    const currentDurationStr = durationItem?.value?.text || durationItem?.value?.number || "0";
    
    const currentStart = cleanStart ? parseFloat(cleanStart) : null;
    const currentDuration = parseFloat(currentDurationStr);

    if (action === "stop") {
      if (!currentStart) return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Timer was not running" }) };

      const now = Date.now();
      const elapsedMinutes = (now - currentStart) / 1000 / 60;
      const newTotal = (currentDuration + Math.max(0, elapsedMinutes)).toFixed(2);

      const durPayload = durationField.type === "number" ? { value: { number: newTotal } } : { value: { text: String(newTotal) } };
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${durationField.id}/item?key=${key}&token=${token}`, "PUT", durPayload);
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${startField.id}/item?key=${key}&token=${token}`, "PUT", { value: "" }); 
      
      return { statusCode: 200, body: JSON.stringify({ ok: true, active: false, total: newTotal }) };
    } 
    else if (action === "start") {
      const nowStr = Date.now().toString();
      const startPayload = startField.type === "number" ? { value: { number: nowStr } } : { value: { text: nowStr } };
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${startField.id}/item?key=${key}&token=${token}`, "PUT", startPayload);
      
      return { statusCode: 200, body: JSON.stringify({ ok: true, active: true, start: nowStr }) };
    }

  } catch (err) {
    console.error("[Backend Timer Error]:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};