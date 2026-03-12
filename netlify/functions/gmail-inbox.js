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

    // 2. ⚡ HISTORIC OVERRIDE: If a keyword is provided, search for emails
    if (q && q.trim()) {
      // Strip any leading in:xxx scope prefix added by the frontend before building query
      const keyword = q.trim().replace(/^in:\S+\s+/, "");
      if (folder === "DRAFTS") {
        // Stay within drafts when user searches from the Drafts folder
        queryParts = [`is:draft ${keyword} -is:chat`];
      } else {
        queryParts = [`in:anywhere ${keyword} -is:chat`];
      }
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
      // 🕵️ FOR SEARCH: resultSizeEstimate is usually capped at 500 or 1,000. 
      // To get the TRUE total, we fetch ONLY message IDs. We've increased this to 25,000 for deep history.
      try {
        const countUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25000&fields=messages(id)`;
        const countRes = await request(countUrl, { headers: { Authorization: `Bearer ${token}` } });
        const countData = await countRes.json();
        
        // Count actual IDs found
        const foundCount = countData.messages ? countData.messages.length : 0;
        
        // If we hit our 25k limit, use Google's estimate as a fallback. Otherwise, use the precise count.
        exactTotal = foundCount >= 25000 ? (listData.resultSizeEstimate || 25000) : foundCount;
        
        // ⚡ Ensure we never return 0 if messages actually exist in the current page
        if (exactTotal === 0 && listData.messages?.length > 0) {
            exactTotal = listData.resultSizeEstimate || listData.messages.length;
        }
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

    // 3. FAST METADATA FETCH: Headers, snippet, and structure for attachments
    const fetchEmailMetadata = async (msg) => {
      // Using format=full but filtering with 'fields' to exclude heavy body.data while preserving attachment metadata
      const fields = "id,snippet,labelIds,payload(headers,parts(filename,mimeType,body/attachmentId,parts(filename,mimeType,body/attachmentId,parts(filename,mimeType,body/attachmentId))))";
      const msgRes = await request(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full&fields=${encodeURIComponent(fields)}`,
        { headers: { Authorization: `Bearer ${token}` }, agent: keepAliveAgent }
      );
      const msgData = await msgRes.json();

      if (!msgRes.ok || !msgData.id) {
        return {
          id: msg.id, snippet: "Could not load.", subject: "(Fetch Error)",
          from: "System", to: "", cc: "", date: new Date().toISOString(),
          messageId: "", labelIds: [], isUnread: false, isStarred: false,
          attachments: [], body: ""
        };
      }

      const headers = msgData.payload?.headers || [];
      const getH = (n) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";

      // Recursively extract attachments from payload parts
      const extractAttachments = (parts) => {
        let atts = [];
        if (!parts) return atts;
        for (const part of parts) {
          if (part.filename && part.body && part.body.attachmentId) {
            atts.push({
              id: part.body.attachmentId,
              name: part.filename,
              mimeType: part.mimeType,
              type: part.mimeType.includes("pdf") ? "pdf" : part.mimeType.includes("image") ? "img" : part.mimeType.includes("spreadsheet") || part.mimeType.includes("excel") ? "xls" : "file",
              url: `/.netlify/functions/gmail-download?messageId=${msg.id}&attachmentId=${part.body.attachmentId}&filename=${encodeURIComponent(part.filename)}&mimeType=${encodeURIComponent(part.mimeType)}`
            });
          }
          if (part.parts) {
            atts = atts.concat(extractAttachments(part.parts));
          }
        }
        return atts;
      };

      const attachments = extractAttachments(msgData.payload?.parts);

      return {
        id: msg.id,
        messageId: getH("Message-ID"),
        snippet: msgData.snippet || "",
        subject: getH("Subject") || "(No Subject)",
        from: getH("From") || "(Unknown)",
        to: getH("To") || "",
        cc: getH("Cc") || "",
        date: getH("Date") || "",
        labelIds: msgData.labelIds || [],
        isUnread: msgData.labelIds?.includes("UNREAD") || false,
        isStarred: msgData.labelIds?.includes("STARRED") || false,
        attachments: attachments,
        body: ""
      };
    };
    // All 50 metadata fetches fire simultaneously — each is tiny so no rate-limit risk
    const unorderedEmails = await Promise.all(messages.map(fetchEmailMetadata));

    // Preserve original sort order from Gmail's list API
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