import https from 'https';
import { getAccessToken } from './_google-creds';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  try {
    const { spaceId, mute } = JSON.parse(event.body);
    const accessToken = await getAccessToken(event);

    // Ensure spaceId is in the correct format for the URL path
    const cleanSpaceId = spaceId.replace('spaces/', '');

    // Convert the boolean `mute` into Google's exact string enum
    const postData = JSON.stringify({
      muteSetting: mute ? "MUTED" : "UNMUTED"
    });

    const options = {
      hostname: 'chat.googleapis.com',
      // Targeting the official spaceNotificationSetting resource to mute/unmute
      path: `/v1/users/me/spaces/${cleanSpaceId}/spaceNotificationSetting?updateMask=muteSetting`,
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