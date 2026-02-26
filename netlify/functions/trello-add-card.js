// netlify/functions/trello-add-card.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { name, idList } = JSON.parse(event.body);
    if (!name || !idList) return { statusCode: 400, body: "Missing card name or list ID" };

    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    // Call Trello API to create the card
    const res = await fetch(`https://api.trello.com/1/cards?idList=${idList}&name=${encodeURIComponent(name)}&key=${key}&token=${token}`, {
      method: 'POST'
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: err }) };
    }

    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify({ ok: true, card: data }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};