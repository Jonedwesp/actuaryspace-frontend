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
    const { to, subject, body } = JSON.parse(event.body);

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

    const encodedSubject = `=?utf-8?B?${Buffer.from(subject || "(No Subject)").toString('base64')}?=`;
    const mimeMessage = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(`<html><body>${(body || "").replace(/\n/g, '<br>')}</body></html>`).toString('base64')
    ].join('\r\n');

    const encodedMail = Buffer.from(mimeMessage)
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