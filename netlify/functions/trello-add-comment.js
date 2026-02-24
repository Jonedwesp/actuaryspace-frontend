const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, text } = JSON.parse(event.body || "{}");
  if (!cardId || !text) return { statusCode: 400, body: JSON.stringify({ error: "Missing cardId or text" }) };

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  // Trello's specific endpoint for adding a comment to a card
  const url = `https://api.trello.com/1/cards/${cardId}/actions/comments?text=${encodeURIComponent(text)}&key=${key}&token=${token}`;

  return new Promise((resolve) => {
    const req = https.request(url, { method: "POST", headers: { "Content-Type": "application/json" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        if (res.statusCode >= 400) {
          resolve({ statusCode: res.statusCode, body: JSON.stringify({ error: data }) });
        } else {
          // Success! Trello returns the new comment action object.
          resolve({ statusCode: 200, body: data });
        }
      });
    });
    req.on("error", (e) => resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) }));
    req.end();
  });
};