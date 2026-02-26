// netlify/functions/trello-toggle-member.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId, memberId, shouldAdd } = JSON.parse(event.body);
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    let url = "";
    let method = "";

    // 🚨 THE FIX: Route the URLs exactly how Trello demands
    if (shouldAdd) {
      // ADD a member
      url = `https://api.trello.com/1/cards/${cardId}/idMembers?value=${memberId}&key=${key}&token=${token}`;
      method = "POST";
    } else {
      // REMOVE a member
      url = `https://api.trello.com/1/cards/${cardId}/idMembers/${memberId}?key=${key}&token=${token}`;
      method = "DELETE";
    }

    const res = await fetch(url, { method: method });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error("Trello API Error:", errText);
      return { statusCode: res.status, body: JSON.stringify({ error: errText }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error("Toggle Member Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};