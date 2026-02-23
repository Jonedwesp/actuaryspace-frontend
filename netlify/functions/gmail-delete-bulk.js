const https = require("https");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AS_GCHAT_RT;

// Request helper consistent with your working inbox logic
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

exports.handler = async (event) => {
  try {
    const { messageIds, permanent } = JSON.parse(event.body);

    // 1. Get a fresh Access Token using Siya's Refresh Token
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
    if (!tokenRes.ok) throw new Error(`Auth failed: ${JSON.stringify(tokenData)}`);
    const token = tokenData.access_token;

    // 2. Loop through and execute Gmail commands
    // 2. Loop through and execute Gmail commands
    for (const id of messageIds) {
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
      let method = permanent ? "DELETE" : "POST";

      // 🔄 ADDED LOGIC: Handle "Untrash" (Restore)
      // 🔄 RESTORE LOGIC
      if (event.queryStringParameters?.action === "restore") {
        url += "/untrash"; // Gmail moves it back to its previous location (usually Inbox)
        method = "POST";
      } else if (!permanent) {
        url += "/trash"; 
      }
      
      const res = await request(url, {
        method,
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Length": 0 
        }
      });

      if (!res.ok) {
        const errorMsg = await res.json();
        throw new Error(`Gmail API failed for ID ${id}: ${JSON.stringify(errorMsg)}`);
      }
    }

    return { 
      statusCode: 200, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }) 
    };
  } catch (err) {
    console.error("Gmail Bulk Action Error:", err);
    return { 
      statusCode: 500, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message }) 
    };
  }
};