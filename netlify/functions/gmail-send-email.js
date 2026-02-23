const https = require("https");

// Helper 1: Base64URL encoder
function makeBase64Url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper 2: Native HTTPS fetch
function fetchJson(url, options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const str = Buffer.concat(chunks).toString();
        try {
          const json = JSON.parse(str || '{}');
          resolve({ status: res.statusCode, json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: str });
        }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

// Helper 3: Refresh Token to Access Token exchange
async function getAccessTokenFromRefresh() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.AS_GCHAT_RT,
    grant_type: "refresh_token",
  });

  const res = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }, params.toString());

  if (res.status !== 200) {
    throw new Error(`Token exchange failed: ${JSON.stringify(res.json)}`);
  }
  return res.json.access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { to, subject, body } = JSON.parse(event.body || "{}");
    
    if (!to || !body) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: "Missing 'to' or 'body'" }) 
      };
    }

    const impersonatedEmail = "siya@actuaryspace.co.za";

    // 1. Get Access Token using the stable Refresh Token method
    let accessToken;
    try {
      accessToken = await getAccessTokenFromRefresh();
    } catch (tokenErr) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ ok: false, error: `Auth Error: ${tokenErr.message}` }) 
      };
    }

    // 2. Construct Raw Email String (RFC 2822 Format) with Signature
    const signature = [
      '',
      'Kind regards,',
      'Siyabonga Nono',
      'Actuary Consulting'
    ].join('\r\n');

    const rawEmail = [
      `To: ${to}`,
      `From: ${impersonatedEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      '',
      body + signature
    ].join('\r\n');

    const encodedEmail = makeBase64Url(rawEmail);

    // 3. Send via Gmail API
    const sendOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const sendBody = JSON.stringify({ raw: encodedEmail });

    const sendRes = await fetchJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', sendOptions, sendBody);

    if (sendRes.status !== 200) {
      const googleError = sendRes.json?.error?.message || "Unknown Gmail API Error";
      return { 
        statusCode: 500, 
        body: JSON.stringify({ ok: false, error: `Gmail API: ${googleError}` }) 
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, messageId: sendRes.json.id })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err) })
    };
  }
};