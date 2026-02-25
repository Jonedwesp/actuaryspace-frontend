exports.handler = async (event) => {
  const { cardId, memberId, shouldAdd } = JSON.parse(event.body);
  const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  const method = shouldAdd ? 'POST' : 'DELETE';
  const url = `https://api.trello.com/1/cards/${cardId}/idMembers?value=${memberId}&key=${key}&token=${token}`;

  try {
    const res = await fetch(url, { method });
    return { statusCode: 200, body: JSON.stringify({ ok: res.ok }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};