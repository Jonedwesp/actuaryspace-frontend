const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId } = JSON.parse(event.body || "{}");
  if (!cardId) return { statusCode: 400, body: "Missing cardId" };

  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;

  try {
    // Archiving in Trello is done by setting "closed=true"
    const options = {
      hostname: "api.trello.com",
      path: `/1/cards/${cardId}?closed=true&key=${key}&token=${token}`,
      method: "PUT"
    };

    const archiveRes = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(data || "{}") }));
      });
      req.on("error", reject);
      req.end();
    });

    if (archiveRes.status >= 200 && archiveRes.status < 300) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } else {
      return { statusCode: archiveRes.status, body: JSON.stringify(archiveRes.data) };
    }

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};