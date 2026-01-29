// netlify/functions/trello-move.js
import fetch from "node-fetch";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { cardId, targetListId } = JSON.parse(event.body || "{}");
    if (!cardId || !targetListId) {
      return { statusCode: 400, body: JSON.stringify({ error: "cardId and targetListId are required" }) };
    }

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    if (!key || !token) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server not configured with Trello credentials" }) };
    }

    // Trello: update card's list
    const url = `https://api.trello.com/1/cards/${encodeURIComponent(cardId)}?idList=${encodeURIComponent(targetListId)}&key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;

    const trelloRes = await fetch(url, { method: "PUT" });
    const data = await trelloRes.json();

    if (!trelloRes.ok) {
      return { statusCode: trelloRes.status, body: JSON.stringify({ error: data?.message || "Trello error", data }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, data }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err?.message || err) }) };
  }
};
