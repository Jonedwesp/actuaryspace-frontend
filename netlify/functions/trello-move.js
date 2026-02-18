const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, targetListId, newIndex } = JSON.parse(event.body || "{}");
  if (!cardId || !targetListId) return { statusCode: 400, body: "Missing IDs" };

  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;

  // Helper to make Trello requests
  const trelloRequest = (path, method = "GET") => new Promise((resolve, reject) => {
    const options = { hostname: "api.trello.com", path, method };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(data || "{}") }));
    });
    req.on("error", reject);
    req.end();
  });

  try {
    // 1. Get the target list to calculate position
    const listRes = await trelloRequest(`/1/lists/${targetListId}/cards?fields=id,pos&key=${key}&token=${token}`);
    
    // Default to 'bottom' if list fetch fails or is empty
    let newPos = "bottom"; 
    
    if (listRes.status === 200 && Array.isArray(listRes.data)) {
        const cards = listRes.data.filter(c => c.id !== cardId);
        const index = typeof newIndex === "number" ? newIndex : -1;

        if (index <= 0) newPos = "top";
        else if (index >= cards.length) newPos = "bottom";
        else {
            const prev = cards[index - 1].pos;
            const next = cards[index].pos;
            newPos = (prev + next) / 2;
        }
    }

    // 2. Move the card
    const movePath = `/1/cards/${cardId}?idList=${targetListId}&pos=${newPos}&key=${key}&token=${token}`;
    const moveRes = await trelloRequest(movePath, "PUT");

    if (moveRes.status >= 200 && moveRes.status < 300) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, pos: newPos }) };
    } else {
      return { statusCode: moveRes.status, body: JSON.stringify(moveRes.data) };
    }

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};