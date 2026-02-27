const https = require('https');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { actionId } = JSON.parse(event.body);
    if (!actionId) return { statusCode: 400, body: JSON.stringify({ error: "Missing actionId" }) };

    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_TOKEN;

    const options = {
      hostname: 'api.trello.com',
      port: 443,
      path: `/1/actions/${actionId}?key=${apiKey}&token=${apiToken}`,
      method: 'DELETE'
    };

    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};