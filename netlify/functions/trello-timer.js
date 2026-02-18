// netlify/functions/trello-timer.js
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

  const { cardId, action } = JSON.parse(event.body || "{}"); // action: "start" or "stop"
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  try {
    // 1. Get Board ID to find Custom Fields
    const cardRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`, "GET");
    const boardId = cardRes.data.idBoard;

    // 2. Find Custom Fields: "TimerStart" and "Duration"
    const cfRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/customFields?key=${key}&token=${token}`, "GET");
    const startField = cfRes.data.find(f => f.name === "TimerStart");
    const durationField = cfRes.data.find(f => f.name === "Duration");

    if (!startField || !durationField) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'TimerStart' or 'Duration' custom fields on Trello board." }) };
    }

    // 3. Get Current Values from Card
    const cardCFRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customFieldItems?key=${key}&token=${token}`, "GET");
    const currentStart = cardCFRes.data.find(f => f.idCustomField === startField.id)?.value?.number;
    const currentDuration = parseFloat(cardCFRes.data.find(f => f.idCustomField === durationField.id)?.value?.number || "0");

    // --- STOP TIMER ---
    if (action === "stop") {
      if (!currentStart) return { statusCode: 200, body: JSON.stringify({ message: "Timer was not running" }) };

      // Calculate elapsed minutes
      const now = Date.now();
      const elapsedMinutes = (now - currentStart) / 1000 / 60;
      const newTotal = currentDuration + elapsedMinutes;

      // Update Duration (Add elapsed)
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${durationField.id}/item?key=${key}&token=${token}`, "PUT", { value: { number: newTotal.toFixed(2) } });

      // Clear Start Time
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${startField.id}/item?key=${key}&token=${token}`, "PUT", { value: "" }); // Clear it
      
      return { statusCode: 200, body: JSON.stringify({ active: false, total: newTotal }) };
    } 
    
    // --- START TIMER ---
    else if (action === "start") {
      if (currentStart) return { statusCode: 200, body: JSON.stringify({ message: "Timer already running" }) };

      const now = Date.now();
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/customField/${startField.id}/item?key=${key}&token=${token}`, "PUT", { value: { number: now.toString() } });
      
      return { statusCode: 200, body: JSON.stringify({ active: true, start: now }) };
    }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};