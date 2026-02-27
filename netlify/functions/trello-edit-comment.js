// netlify/functions/trello-edit-comment.js
const https = require('https');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'PUT') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { actionId, text } = JSON.parse(event.body);
    if (!actionId || !text) return { statusCode: 400, body: JSON.stringify({ error: "Missing actionId or text" }) };

    const apiKey = process.env.TRELLO_API_KEY;
    const apiToken = process.env.TRELLO_TOKEN;

    // Trello API endpoint for updating a comment action
    const options = {
      hostname: 'api.trello.com',
      port: 443,
      path: `/1/actions/${actionId}?text=${encodeURIComponent(text)}&key=${apiKey}&token=${apiToken}`,
      method: 'PUT'
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

    return { statusCode: 200, body: result.data };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};