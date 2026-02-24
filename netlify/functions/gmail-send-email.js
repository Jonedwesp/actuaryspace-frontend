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
    const { to, subject, body, attachments = [] } = JSON.parse(event.body || "{}");
    
    if (!to || !body) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: "Missing 'to' or 'body'" }) 
      };
    }

    const impersonatedEmail = "siyabonga@actuaryconsulting.co.za";

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

  // 2. Construct Raw Email String (RFC 2822 Format) with HTML Signature and Attachments
    const htmlSignature = `
    <br><br>
    <div style="font-family: Verdana, Arial, sans-serif; font-size: 13px; color: #3c4043; line-height: 1.6; cursor: default;">
      <div style="margin-bottom: 16px;">Kind regards</div>
      <div style="color: #b38f6a; font-weight: bold; font-size: 15px; margin-bottom: 16px;">Siyabonga Nono</div>
      <div style="color: #b38f6a; margin-bottom: 16px;">Bsc in Math Science in Actuarial Science</div>
      
      <div style="margin-bottom: 12px; color: #5f6368;">
        <b style="color: #5f6368;">T</b> 011 463 0313 <span style="display: inline-block; width: 8px;"></span> <b style="color: #5f6368;">M</b> 072 689 0562
      </div>
      <div style="margin-bottom: 12px; color: #5f6368;">
        <b style="color: #5f6368;">E</b> <a href="mailto:siyabonga@actuaryconsulting.co.za" style="color: #1a73e8; text-decoration: none;">siyabonga@actuaryconsulting.co.za</a> <span style="display: inline-block; width: 8px;"></span> <b style="color: #5f6368;">W</b> <a href="http://actuaryconsulting.co.za" style="color: #1a73e8; text-decoration: none;">actuaryconsulting.co.za</a>
      </div>
      <div style="margin-bottom: 20px; color: #5f6368;">
        <b style="color: #5f6368;">A</b> Corner 5th &amp; Maude Street, Sandown, Sandton, 2031
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 32px; color: #b38f6a; letter-spacing: 1px; line-height: 1;">ACTUARY</div>
        <div style="font-family: Verdana, sans-serif; font-size: 12px; color: #5f6368; letter-spacing: 6.5px; margin-top: 6px; margin-left: 2px;">CONSULTING</div>
      </div>
      
      <div style="font-size: 10px; color: #9aa0a6; line-height: 1.5; text-align: justify; border-top: 1px solid #f1f3f4; padding-top: 12px;">
        The information contained in this email is confidential and may be subject to legal privilege. The content of this email, which may include one or more attachments, is strictly confidential, and is intended solely for the use of the named recipient/s. If you are not the intended recipient, you cannot use, copy, distribute, disclose or retain the email or any part of its contents or take any action in reliance on it. If you have received this email in error, please email the sender by replying to this message and to permanently delete it and all attachments from your computer. All reasonable precautions have been taken to ensure that no viruses are present in this email and the company cannot accept responsibility for any loss or damage arising from the use of this email or attachments.
      </div>
    </div>
    `;

    // Convert the plaintext body into HTML by replacing newlines with <br> tags, then append signature
    const htmlBody = `<div style="font-family: Verdana, sans-serif; font-size: 14px; color: #202124;">${(body || "").replace(/\n/g, '<br>')}</div>` + htmlSignature;

  const boundary = "actuaryspace_boundary_" + Date.now().toString(16);

    let rawEmailParts = [
      `To: ${to}`,
      `From: "Siyabonga Nono" <${impersonatedEmail}>`,
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      '',
      htmlBody,
      ''
    ];

    // Append attachments if any exist
    for (const att of attachments) {
      rawEmailParts.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        '',
        att.content,
        ''
      );
    }

    // Close the boundary
    rawEmailParts.push(`--${boundary}--`);

    const rawEmail = rawEmailParts.join('\r\n');
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