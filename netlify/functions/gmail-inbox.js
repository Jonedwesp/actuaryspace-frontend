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
    const q = event.queryStringParameters?.q || ""; // 👈 Catch the search keyword
    
    let queryParts = [];
    let labelId = "INBOX";

    // 1. Handle Folder Scoping and the "Unified Inbox" requirement
    if (folder === "TRASH") { 
      queryParts.push("is:trash"); 
      labelId = "TRASH"; 
    } else if (folder === "STARRED") { 
      queryParts.push("is:starred -is:trash -is:chat"); 
      labelId = "STARRED"; 
    } else if (folder === "SENT") { 
      queryParts.push("in:sent -is:trash -is:chat"); 
      labelId = "SENT"; 
    } else if (folder === "DRAFTS") { 
      queryParts.push("is:draft -is:trash -is:chat"); 
      labelId = "DRAFT"; 
    } else {
      // ⚡ UNIFIED INBOX (Removed is:sent as requested)
      queryParts.push("(in:inbox OR is:draft) -is:chat -is:trash"); 
      labelId = "INBOX";
    }

    // 2. ⚡ HISTORIC OVERRIDE: If a keyword is provided, search 'anywhere' to find old emails
    if (q && q.trim()) {
      // We clear queryParts and use 'anywhere' to find matches regardless of current folder
      const keyword = q.trim();
      queryParts = [`in:anywhere "${keyword}" -is:chat` ];
    }

    const query = queryParts.join(" ");

    // 1. Clean the Page Token (Fixes the "Next Page" bug)
    let pageToken = event.queryStringParameters?.pageToken || "";
    if (pageToken === "undefined" || pageToken === "null") pageToken = "";

    let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;
    if (pageToken) listUrl += `&pageToken=${pageToken}`;

    // 2. ⚡ SMART FETCH: Handle search vs folder view correctly
    let listRes;
    let labelRes = { ok: false }; // Initialize with a default state to prevent "not defined" errors

    if (q && q.trim()) {
      // 🕵️ GLOBAL SEARCH: Directly fetch the list without label constraints
      listRes = await request(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    } else {
      // STANDARD FOLDER VIEW: Fetch both simultaneously
      const [lRes, mRes] = await Promise.all([
        request(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`, { headers: { Authorization: `Bearer ${token}` } }),
        request(listUrl, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      labelRes = lRes;
      listRes = mRes;
    }

    const listData = await listRes.json();
    if (!listRes.ok) {
      const errorMsg = listData.error?.message || JSON.stringify(listData);
      if (listRes.status === 403) throw new Error(`Insufficient Permissions: Siya must re-authorize.`);
      throw new Error(`Gmail List Error: ${errorMsg}`);
    }

    let exactTotal = 0;
    
    // ⚡ ACCURATE HISTORICAL COUNTER LOGIC
    if (q && q.trim()) {
      // 🕵️ FOR SEARCH: resultSizeEstimate is capped. 
      // To get the TRUE total, we fetch ONLY the message IDs for the entire query.
      try {
        const countUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10000&fields=messages(id)`;
        const countRes = await request(countUrl, { headers: { Authorization: `Bearer ${token}` } });
        const countData = await countRes.json();
        
        // The length of the messages array is the real historical count
        exactTotal = countData.messages ? countData.messages.length : 0;
        
        // If we hit exactly 10,000, we use the estimate as a fallback for massive inboxes
        if (exactTotal === 10000) exactTotal = listData.resultSizeEstimate || 10000;
      } catch (e) {
        console.error("Historical count failed, falling back to estimate", e);
        exactTotal = listData.resultSizeEstimate || 0;
      }
    } else if (labelRes.ok && (folder === "INBOX" || folder === "TRASH" || folder === "SENT" || folder === "DRAFTS")) {
      const labelData = await labelRes.json();
      exactTotal = labelData.threadsTotal || labelData.messagesTotal || 0;
    } else {
      exactTotal = listData.resultSizeEstimate || 0;
    }

    const messages = listData.messages || [];
    
    // ⚡ PAGINATION FIX: If we have zero messages but a total count (common in deep pagination), 
    // we return the total so the UI doesn't reset the "1-50 of X" bar to zero.
    if (messages.length === 0) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          ok: true, 
          emails: [], 
          total: exactTotal,
          nextPageToken: listData.nextPageToken || null 
        }) 
      };
    }

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
        cc: getH("Cc") || "", 
        date: getH("Date") || "",
        labelIds: msgData.labelIds || [], // ⚡ FIX: Explicitly send label IDs to the frontend
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