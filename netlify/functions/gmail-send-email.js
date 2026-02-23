const https = require('https');
const getAccessToken = require('./_sa-token'); // Re-using your Service Account generator

// Helper 1: Base64URL encoder (Gmail requires this specific format)
function makeBase64Url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper 2: Native HTTPS fetch to prevent crashes
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

exports.handler = async (event) => {
  // Only allow POST requests
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

    // 1. Determine Identity based on Environment (Siya vs Yolandie)
    const persona = process.env.VITE_PERSONA || "SIYA";
    const impersonatedEmail = persona.toUpperCase() === "YOLANDIE" 
      ? "yolandie@actuaryspace.co.za" 
      : "siya@actuaryspace.co.za";

    // 2. Get Service Account Token for Gmail Impersonation
    const accessToken = await getAccessToken([
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify"
    ], impersonatedEmail);

    if (!accessToken) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ ok: false, error: "Failed to generate Service Account token" }) 
      };
    }

    // 3. Construct Raw Email String (RFC 2822 Format)
    // CRITICAL: The 'From' header is strictly required when using Service Accounts
    const rawEmail = `To: ${to}\r\n` +
                     `From: ${impersonatedEmail}\r\n` +
                     `Subject: ${subject}\r\n` +
                     `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
                     `${body}`;

    // 4. Encode the email to Base64URL
    const encodedEmail = makeBase64Url(rawEmail);

    // 5. Send via Gmail API
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
      console.error("Gmail send failed:", sendRes.json || sendRes.raw);
      // Pass the exact Google error message to the frontend popup
      const googleError = sendRes.json?.error?.message || "Unknown Google API Error";
      return { 
        statusCode: 500, 
        body: JSON.stringify({ ok: false, error: `Gmail API: ${googleError}` }) 
      };
    }

    // Success!
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, messageId: sendRes.json.id })
    };

  } catch (err) {
    console.error("gmail-send-email fatal error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err) })
    };
  }
};