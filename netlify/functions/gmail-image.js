const https = require("https");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AS_GCHAT_RT;

function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOpts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = https.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(data || "{}"),
        });
      });
    });

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

exports.handler = async function (event, context) {
  try {
    const { messageId, attachmentId, mimeType } = event.queryStringParameters || {};
    
    if (!messageId || !attachmentId) {
      return { statusCode: 400, body: "Missing messageId or attachmentId" };
    }

    const bodyStr = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString();

    const tokenRes = await request("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
      body: bodyStr,
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error("Auth failed");
    const token = tokenData.access_token;

    const attachRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const attachData = await attachRes.json();

    if (attachData.data) {
      // Convert URL-safe base64 to standard base64 for the browser
      const base64 = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
      
      return {
        statusCode: 200,
        headers: {
          "Content-Type": mimeType || "image/jpeg",
          "Cache-Control": "public, max-age=86400"
        },
        isBase64Encoded: true,
        body: base64
      };
    }

    return { statusCode: 404, body: "Attachment not found" };
  } catch (err) {
    console.error("Gmail Image proxy error:", err);
    return { statusCode: 500, body: err.message };
  }
};