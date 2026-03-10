// netlify/functions/trello-attach-link.js
export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId, url, name } = JSON.parse(event.body);
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    const params = new URLSearchParams({ key, token, url });
    if (name && name.trim() !== "") params.set('name', name.trim());

    const res = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments?${params}`, {
      method: 'POST',
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