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

    // Log scopes for debugging (optional, check logs to see if gmail.readonly is present)
    if (tokenData.scope) {
      console.log("Current Token Scopes:", tokenData.scope);
    }

   // 1. Determine which folder to look in (default to INBOX)
    const folder = event.queryStringParameters?.folder || "INBOX";
    
    // 2. Map folder names to Gmail search queries
    // 'label:trash' is the specific query required to see items in the Bin
    const query = folder === "TRASH" ? "label:trash" : "in:inbox";
    

    const listRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=15`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    
    // Improved error reporting for 403 Scopes issue
    if (!listRes.ok) {
      const errorMsg = listData.error?.message || JSON.stringify(listData);
      if (listRes.status === 403) {
        throw new Error(`Insufficient Permissions: Siya must re-authorize using the link provided to grant Gmail access.`);
      }
      throw new Error(`Gmail List Error: ${errorMsg}`);
    }

    const messages = listData.messages || [];
    if (messages.length === 0) return { statusCode: 200, body: JSON.stringify({ ok: true, emails: [] }) };

    const emails = await Promise.all(
  messages.map(async (msg) => {
    // 1. Changed format to 'full' to get the actual message content
    const msgRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msgData = await msgRes.json();
    const headers = msgData.payload?.headers || [];
    const getH = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";

    // 2. Helper to find the body in the nested parts structure
const getBody = (payload) => {
  let result = "";
  if (payload.parts) {
    // Try to find plain text part first for best formatting
    const textPart = payload.parts.find(p => p.mimeType === "text/plain");
    if (textPart && textPart.body?.data) {
      result = textPart.body.data;
    } else {
      // Fallback to recursive search if deep nested
      payload.parts.forEach(part => {
        if (!result) result = getBody(part);
      });
    }
  } else if (payload.body?.data) {
    result = payload.body.data;
  }
  return result;
};

  const rawBody = getBody(msgData.payload);
    // 3. Decode Base64 (Gmail uses URL-safe Base64)
    const decodedBody = Buffer.from(rawBody.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

    return {
      id: msg.id,
      snippet: msgData.snippet || "",
      // Preserve newlines and full text for the frontend thread parser [cite: 566, 567]
      body: decodedBody || msgData.snippet || "", 
      subject: getH("Subject") || "(No Subject)",
      from: getH("From") || "(Unknown)",
      date: getH("Date") || "",
      isUnread: msgData.labelIds?.includes("UNREAD") || false,
    };
  })
);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, emails }),
    };
  } catch (err) {
    console.error("Gmail Inbox Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};