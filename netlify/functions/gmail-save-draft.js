const https = require("https");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AS_GCHAT_RT;

async function googleRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: { ...headers }
    };
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data: JSON.parse(data || "{}")
          });
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, error: "Invalid JSON from Google" });
        }
      });
    });
    req.on("error", (e) => reject(e));
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { to, subject, body, attachments = [] } = JSON.parse(event.body);

    const tokenParams = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString();

    const tokenRes = await googleRequest("https://oauth2.googleapis.com/token", "POST", { 
      "Content-Type": "application/x-www-form-urlencoded" 
    }, tokenParams);

    const token = tokenRes.data?.access_token;
    if (!token) throw new Error("Auth Failure: Check AS_GCHAT_RT environment variable.");

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

    const htmlBody = `<div style="font-family: Verdana, sans-serif; font-size: 14px; color: #202124;">${(body || "").replace(/\n/g, '<br>')}</div>` + htmlSignature;
    const boundary = "actuaryspace_boundary_" + Date.now().toString(16);

    const safeSubject = subject || "New Message";
    const encodedSubject = `=?utf-8?B?${Buffer.from(safeSubject).toString('base64')}?=`;
    const impersonatedEmail = "siyabonga@actuaryconsulting.co.za";

    let rawEmailParts = [
      `To: ${to || ""}`,
      `From: "Siyabonga Nono" <${impersonatedEmail}>`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      '',
      htmlBody,
      ''
    ];

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
    rawEmailParts.push(`--${boundary}--`);

    const encodedMail = Buffer.from(rawEmailParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const draftRes = await googleRequest("https://gmail.googleapis.com/gmail/v1/users/me/drafts", "POST", {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }, JSON.stringify({ message: { raw: encodedMail } }));

    if (!draftRes.ok) {
      return { 
        statusCode: draftRes.status, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: draftRes.data?.error?.message || "Gmail API rejection" }) 
      };
    }

    return { 
      statusCode: 200, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, id: draftRes.data.id }) 
    };
  } catch (err) {
    return { 
      statusCode: 500, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message }) 
    };
  }
};