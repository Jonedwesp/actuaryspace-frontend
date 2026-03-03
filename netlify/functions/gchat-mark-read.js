const https = require('https');
const { getAccessToken } = require('./_google-creds');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  try {
    const { spaceId } = JSON.parse(event.body);
    const accessToken = await getAccessToken(event);

    // Ensure spaceId is in the correct format for the URL path
    const cleanSpaceId = spaceId.replace('spaces/', '');

    const postData = JSON.stringify({
      lastReadTime: new Date().toISOString()
    });

    const options = {
      hostname: 'chat.googleapis.com',
      // Targeting the official spaceReadState resource for the user
      path: `/v1/users/me/spaces/${cleanSpaceId}/spaceReadState?updateMask=lastReadTime`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: 200,
              body: JSON.stringify({ ok: true })
            });
          } else {
            console.error("Google API Error:", responseBody);
            resolve({
              statusCode: res.statusCode,
              body: JSON.stringify({ ok: false, error: `API returned ${res.statusCode}` })
            });
          }
        });
      });

      req.on('error', (err) => {
        console.error("HTTPS Request Error:", err.message);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ ok: false, error: err.message })
        });
      });

      req.write(postData);
      req.end();
    });
  } catch (err) {
    console.error("Handler Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};