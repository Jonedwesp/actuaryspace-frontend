const https = require("https");

const trelloRequest = (url, method, body) => new Promise((resolve, reject) => {
  const req = https.request(url, {
    method: method,
    headers: { "Content-Type": "application/json" }
  }, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(data || "{}") }));
  });
  req.on("error", reject);
  if (body) req.write(JSON.stringify(body));
  req.end();
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, action } = JSON.parse(event.body || "{}");
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  try {
    // 1. Get Board ID
    const cardRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`, "GET");
    const boardId = cardRes.data.idBoard;

    // 2. Find Custom Fields (Supports both your old Timer and new WorkFlow Timer)
    const cfRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/customFields?key=${key}&token=${token}`, "GET");
    const startField = cfRes.data.find(f => f.name.includes("TimerStart"));
const durationField = cfRes.data.find(f => f.name.includes("Duration"));

    if (!startField || !durationField) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing timer custom fields on Trello board." }) };
    }

    // 3. Get Current Values from Card (Safely handles both Text and Number types)
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

      // Smart Payload formatting
      const durPayload = durationField.type === "number" ? { value: { number: newTotal } } : { value: { text: String(newTotal) } };
      const startPayload = { value: "" }; // Clears the field cleanly

      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${durationField.id}/item?key=${key}&token=${token}`, "PUT", durPayload);
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${startField.id}/item?key=${key}&token=${token}`, "PUT", startPayload);
      
      return { statusCode: 200, body: JSON.stringify({ active: false, total: newTotal }) };
    } 
    
    // --- START TIMER ---
    else if (action === "start") {
      if (currentStart) return { statusCode: 200, body: JSON.stringify({ message: "Timer already running" }) };

      const nowStr = Date.now().toString();
      
      // Smart Payload formatting
      const startPayload = startField.type === "number" ? { value: { number: nowStr } } : { value: { text: nowStr } };

      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${startField.id}/item?key=${key}&token=${token}`, "PUT", startPayload);
      
      return { statusCode: 200, body: JSON.stringify({ active: true, start: nowStr }) };
    }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};