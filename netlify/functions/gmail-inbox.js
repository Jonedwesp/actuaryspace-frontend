// netlify/functions/gmail-inbox.js
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

    // 1. Determine folder and limit
    const folder = event.queryStringParameters?.folder || "INBOX";
    const limit = event.queryStringParameters?.limit || "50"; 
    
    // 2. Map folder names to Gmail search queries and strict Label IDs
    let query = "in:inbox";
    let labelId = "INBOX";

    if (folder === "TRASH") { query = "is:trash"; labelId = "TRASH"; }
    if (folder === "STARRED") { query = "is:starred"; labelId = "STARRED"; }
    if (folder === "SENT") { query = "in:sent"; labelId = "SENT"; }
    if (folder === "DRAFTS") { query = "label:DRAFT -in:inbox"; labelId = "DRAFT"; }

    // 3. EXACT COUNT FIX: Query the specific label profile for the true database total
    let exactTotal = 0;
    try {
      const labelRes = await request(
        `https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (labelRes.ok) {
        const labelData = await labelRes.json();
        exactTotal = labelData.messagesTotal || 0;
      }
    } catch (e) {
      console.warn("Failed to fetch exact label count", e);
    }

    // 4. Fetch the message list
    const listRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    
    if (!listRes.ok) {
      const errorMsg = listData.error?.message || JSON.stringify(listData);
      if (listRes.status === 403) {
        throw new Error(`Insufficient Permissions: Siya must re-authorize using the link provided to grant Gmail access.`);
      }
      throw new Error(`Gmail List Error: ${errorMsg}`);
    }

    const messages = listData.messages || [];
    if (messages.length === 0) return { statusCode: 200, body: JSON.stringify({ ok: true, emails: [], total: exactTotal }) };

    // Fallback to estimate ONLY if the label API failed
    if (exactTotal === 0) exactTotal = listData.resultSizeEstimate || 0;

    const emails = await Promise.all(
      messages.map(async (msg) => {
        const msgRes = await request(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const getH = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";

        let typeMap = { html: "", plain: "", inlineImages: {}, attachments: [] };

        const extractParts = (part) => {
          if (part.mimeType === 'text/html' && !typeMap.html) typeMap.html = part.body?.data;
          if (part.mimeType === 'text/plain' && !typeMap.plain) typeMap.plain = part.body?.data;

          if (part.headers) {
            const cidHeader = part.headers.find(h => h.name.toLowerCase() === 'content-id');
            if (cidHeader) {
              const cid = cidHeader.value.replace(/[<>]/g, '');
              if (part.body?.data) {
                 typeMap.inlineImages[cid] = `data:${part.mimeType};base64,${part.body.data.replace(/-/g, '+').replace(/_/g, '/')}`;
              } else if (part.body?.attachmentId) {
                 typeMap.inlineImages[cid] = `/.netlify/functions/gmail-image?messageId=${msg.id}&attachmentId=${part.body.attachmentId}&mimeType=${encodeURIComponent(part.mimeType)}`;
              }
            }
          }

          if (part.filename && part.filename.trim() !== "") {
              typeMap.attachments.push({
                  id: part.body?.attachmentId || part.partId || `file-${Date.now()}`,
                  name: part.filename,
                  mimeType: part.mimeType,
                  size: part.body?.size || 0
              });
          }

          if (part.parts) part.parts.forEach(extractParts);
        };

        if (msgData.payload) extractParts(msgData.payload);

        let rawBody = typeMap.html || typeMap.plain || "";
        let decodedBody = "";
        
        if (rawBody) {
           decodedBody = Buffer.from(rawBody.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        } else {
           decodedBody = msgData.snippet || "";
        }

        Object.keys(typeMap.inlineImages).forEach(cid => {
           const imgSrc = typeMap.inlineImages[cid];
           const regex = new RegExp(`cid:['"]?${cid}['"]?`, 'gi');
           decodedBody = decodedBody.replace(regex, imgSrc);
        });

        return {
          id: msg.id,
          snippet: msgData.snippet || "",
          body: decodedBody || msgData.snippet || "", 
          subject: getH("Subject") || "(No Subject)",
          from: getH("From") || "(Unknown)",
          date: getH("Date") || "",
          isUnread: msgData.labelIds?.includes("UNREAD") || false,
          isStarred: msgData.labelIds?.includes("STARRED") || false,
          attachments: typeMap.attachments
        };
      })
    );

    return {
      statusCode: 200,
      // Pass the exact total back to the frontend
      body: JSON.stringify({ ok: true, emails, total: exactTotal }),
    };
  } catch (err) {
    console.error("Gmail Inbox Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};