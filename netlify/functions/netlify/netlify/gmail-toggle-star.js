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

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { messageId, starred } = JSON.parse(event.body);

    // 1. Get Access Token
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
    const token = tokenData.access_token;

    // 2. Define the Payload
    const modifyPayload = JSON.stringify({
      addLabelIds: starred ? ["STARRED"] : [],
      removeLabelIds: !starred ? ["STARRED"] : [],
    });

    // 3. Send Request to Gmail
    const modifyRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(modifyPayload),
        },
        body: modifyPayload,
      }
    );

    // ⚡ THE CRITICAL FIX: If status is 200-299, it IS a success regardless of body
    if (modifyRes.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      };
    } else {
      // If NOT ok, then we care about the error message
      const errBody = await modifyRes.json().catch(() => ({ error: "Unknown API error" }));
      return {
        statusCode: modifyRes.status || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: errBody }),
      };
    }
  } catch (err) {
    console.error("Star Toggle Crash:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};