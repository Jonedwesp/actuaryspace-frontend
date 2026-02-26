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
    const { messageId, attachmentId, filename, mimeType } = event.queryStringParameters || {};
    
    if (!messageId || !attachmentId) return { statusCode: 400, body: "Missing parameters" };

    const bodyStr = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString();

    const tokenRes = await request("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(bodyStr) },
      body: bodyStr,
    });
    const token = (await tokenRes.json()).access_token;

    const attachRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const attachData = await attachRes.json();

    if (attachData.data) {
      const base64 = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
      
      // 🟢 Determine if the file should be shown inline (PDF/Images) or downloaded (Word/Excel)
      const isViewable = mimeType === "application/pdf" || mimeType.startsWith("image/");
      const disposition = isViewable ? "inline" : "attachment";

      return {
        statusCode: 200,
        headers: {
          "Content-Type": mimeType || "application/octet-stream",
          // ⚡ FIX: Use 'inline' for PDFs so they render in your iframe preview
          "Content-Disposition": `${disposition}; filename="${filename || 'Document'}"`,
          "Access-Control-Allow-Origin": "*", // Ensures the browser allows the iframe to load the content
        },
        isBase64Encoded: true,
        body: base64
      };
    }
    return { statusCode: 404, body: "Not found" };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};