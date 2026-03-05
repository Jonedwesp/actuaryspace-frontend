import https from 'https';

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId } = JSON.parse(event.body);
    const { TRELLO_TOKEN, TRELLO_API_KEY } = process.env;

    const options = {
      hostname: 'api.trello.com',
      path: `/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
      method: 'DELETE'
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ statusCode: 200, body: JSON.stringify({ ok: true }) }));
      });
      req.on('error', (e) => reject({ statusCode: 500, body: JSON.stringify({ error: e.message }) }));
      req.end();
    });
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
