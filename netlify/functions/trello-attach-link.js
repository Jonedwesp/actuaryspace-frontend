// netlify/functions/trello-attach-link.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId, url, name } = JSON.parse(event.body);
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    const payload = { url: url };
    if (name && name.trim() !== "") payload.name = name;

    const res = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments?key=${key}&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Trello Link Attach Error:", err);
      return { statusCode: res.status, body: JSON.stringify({ error: err }) };
    }

    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify({ ok: true, attachment: data }) };

  } catch (err) {
    console.error("Link attach process crashed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};