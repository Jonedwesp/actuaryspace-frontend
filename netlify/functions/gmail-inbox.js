// netlify/functions/gmail-inbox.js
import https from "https";
import { Buffer } from "buffer";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AS_GCHAT_RT;

// FAST KEEP-ALIVE: Reuses TLS connections to drastically cut connection overhead
const keepAliveAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 15, 
  keepAliveMsecs: 5000 
});

function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOpts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: options.headers || {},
      agent: options.agent || undefined,
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

export const handler = async function (event, context) {
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

const folder = event.queryStringParameters?.folder || "INBOX";
    const limit = event.queryStringParameters?.limit || "50"; 
    
    let query = "in:inbox -is:chat"; // 👈 Added -is:chat to remove message logs from count
    let labelId = "INBOX";

    if (folder === "TRASH") { 
      query = "is:trash"; labelId = "TRASH"; 
    } else if (folder === "STARRED") { 
      query = "is:starred -is:trash -is:chat"; labelId = "STARRED"; 
    } else if (folder === "SENT") { 
      query = "in:sent -is:trash -is:chat"; labelId = "SENT"; 
    } else if (folder === "DRAFTS") { 
      query = "is:draft -is:trash -is:chat"; labelId = "DRAFT"; 
    
    }

    // 1. Clean the Page Token (Fixes the "Next Page" bug)
    let pageToken = event.queryStringParameters?.pageToken || "";
    if (pageToken === "undefined" || pageToken === "null") pageToken = "";

    let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;
    if (pageToken) listUrl += `&pageToken=${pageToken}`;

    // 2. Fetch Label Data and Inbox List simultaneously to save time
    const [labelRes, listRes] = await Promise.all([
      request(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`, { headers: { Authorization: `Bearer ${token}` } }),
      request(listUrl, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    const listData = await listRes.json();
    if (!listRes.ok) {
      const errorMsg = listData.error?.message || JSON.stringify(listData);
      if (listRes.status === 403) throw new Error(`Insufficient Permissions: Siya must re-authorize.`);
      throw new Error(`Gmail List Error: ${errorMsg}`);
    }

    let exactTotal = 0;
    // For standard labels like INBOX and TRASH, the label metadata is authoritative.
    // For queries like "is:starred -is:trash", the label count (STARRED) includes trash.
    // So for those, we use resultSizeEstimate to ensure trash is excluded from the count.
    if (labelRes.ok && (folder === "INBOX" || folder === "TRASH")) {
      const labelData = await labelRes.json();
      // 🎯 THE DISCREPANCY FIX: 
      // Siya sees 10,461 in Gmail because the app counts THREADS by default.
      // messagesTotal returns the count of every individual email, which is always higher.
      exactTotal = labelData.threadsTotal || labelData.messagesTotal || 0;
    } else {
      exactTotal = listData.resultSizeEstimate || 0;
    }

    const messages = listData.messages || [];
    if (messages.length === 0) return { statusCode: 200, body: JSON.stringify({ ok: true, emails: [], total: exactTotal }) };

    // 3. THE CONCURRENCY POOL (The Speed Fix)
    // Ensures exactly 12 emails are downloaded at a time. No delays, no rate limits, maximum speed.
    const fetchEmail = async (msg) => {
      const msgRes = await request(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` }, agent: keepAliveAgent }
      );
      const msgData = await msgRes.json();

      if (!msgRes.ok || !msgData.payload) {
        return {
          id: msg.id,
          snippet: "Message could not be loaded. Please open to retry.",
          body: "",
          subject: "(Fetch Error)",
          from: "System",
          to: "",
          date: new Date().toISOString(),
          isUnread: false,
          isStarred: false,
          attachments: []
        };
      }

      const headers = msgData.payload?.headers || [];
      const getH = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";

      let typeMap = { html: "", plain: "", inlineImages: {}, attachments: [] };

      const extractParts = (part) => {
        if (!part) return;
        if (part.mimeType === 'text/html' && !typeMap.html) typeMap.html = part.body?.data || "";
        if (part.mimeType === 'text/plain' && !typeMap.plain) typeMap.plain = part.body?.data || "";

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
      let decodedBody = rawBody ? Buffer.from(rawBody.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : (msgData.snippet || "");

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
        to: getH("To") || "",
        cc: getH("Cc") || "", // 👈 Added CC to pick up more historical contacts
        date: getH("Date") || "",
        isUnread: msgData.labelIds?.includes("UNREAD") || false,
        isStarred: msgData.labelIds?.includes("STARRED") || false,
        attachments: typeMap.attachments
      };
    };

    const maxConcurrent = 12; 
    const executing = new Set();
    const results = [];

    // Feed the pool continuously
    for (const msg of messages) {
      const p = fetchEmail(msg);
      results.push(p);
      executing.add(p);
      
      const clean = p.finally(() => executing.delete(p));
      if (executing.size >= maxConcurrent) {
        await Promise.race(executing);
      }
    }

    const unorderedEmails = await Promise.all(results);

    // Re-sort the emails chronologically since the pool finishes them out of order
    const orderMap = new Map(messages.map((m, i) => [m.id, i]));
    const emails = unorderedEmails.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        ok: true, 
        emails, 
        total: exactTotal,
        nextPageToken: listData.nextPageToken || null
      }),
    };
  } catch (err) {
    console.error("Gmail Inbox Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};