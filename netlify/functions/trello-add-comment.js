import https from 'https';

export const handler = async (event) => {
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
          resolve({ statusCode: res.statusCode, body: JSON.stringify({ ok: false, error: data }) });
        } else {
          // Success! Parse Trello response and wrap it in our standard 'ok' field
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: 200, body: JSON.stringify({ ok: true, action: parsed }) });
          } catch (e) {
            resolve({ statusCode: 200, body: JSON.stringify({ ok: true, raw: data }) });
          }
        }
      });
    });
    req.on("error", (e) => resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) }));
    req.end();
  });
};