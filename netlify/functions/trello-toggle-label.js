const https = require("https");

// Helper for Trello requests
const trelloRequest = (url, method) => new Promise((resolve, reject) => {
  const req = https.request(url, { method }, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(data || "{}") }));
  });
  req.on("error", reject);
  req.end();
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, labelName, shouldAdd } = JSON.parse(event.body || "{}");
  if (!cardId || !labelName) return { statusCode: 400, body: "Missing cardId or labelName" };

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  try {
    // 1. Get the card to find its Board ID
    const cardRes = await trelloRequest(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`, "GET");
    if (cardRes.status !== 200) throw new Error("Failed to fetch card");
    const boardId = cardRes.data.idBoard;

    // 2. Get all labels on the board to find the ID matching "labelName"
    const labelsRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}`, "GET");
    const labelObj = (labelsRes.data || []).find(l => (l.name || "").toLowerCase() === labelName.toLowerCase());

    if (!labelObj) return { statusCode: 404, body: JSON.stringify({ error: `Label '${labelName}' not found on board` }) };

    // 3. Add or Remove
    if (shouldAdd) {
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/idLabels?value=${labelObj.id}&key=${key}&token=${token}`, "POST");
    } else {
      await trelloRequest(`https://api.trello.com/1/cards/${cardId}/idLabels/${labelObj.id}?key=${key}&token=${token}`, "DELETE");
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};