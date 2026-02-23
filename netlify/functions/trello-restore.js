const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const { cardId } = JSON.parse(event.body || "{}");
  if (!cardId) return { statusCode: 400, body: "Missing cardId" };

  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;

  try {
    const res = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.trello.com",
        path: `/1/cards/${cardId}?closed=false&key=${key}&token=${token}`,
        method: "PUT"
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(data || "{}") }));
      });
      req.on("error", reject);
      req.end();
    });

    return { statusCode: res.status, body: JSON.stringify({ ok: res.status === 200 }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};