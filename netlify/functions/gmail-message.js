import https from "https";
import { Buffer } from "buffer";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.AS_GCHAT_RT;

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 5, keepAliveMsecs: 5000 });

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

export const handler = async function (event) {
  try {
    const { messageId } = event.queryStringParameters || {};
    if (!messageId) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Missing messageId" }) };
    }

    // Get access token
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

    // Fetch full message
    const msgRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` }, agent: keepAliveAgent }
    );
    const msgData = await msgRes.json();

    if (!msgRes.ok || !msgData.payload) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: "Message not found" }) };
    }

    let typeMap = { html: "", plain: "", inlineImages: {}, attachments: [] };

    const extractParts = (part) => {
      if (!part) return;
      if (part.mimeType === "text/html" && !typeMap.html) typeMap.html = part.body?.data || "";
      if (part.mimeType === "text/plain" && !typeMap.plain) typeMap.plain = part.body?.data || "";

      if (part.headers) {
        const cidHeader = part.headers.find(h => h.name.toLowerCase() === "content-id");
        if (cidHeader) {
          const cid = cidHeader.value.replace(/[<>]/g, "");
          if (part.body?.data) {
            typeMap.inlineImages[cid] = `data:${part.mimeType};base64,${part.body.data.replace(/-/g, "+").replace(/_/g, "/")}`;
          } else if (part.body?.attachmentId) {
            typeMap.inlineImages[cid] = `/.netlify/functions/gmail-image?messageId=${messageId}&attachmentId=${part.body.attachmentId}&mimeType=${encodeURIComponent(part.mimeType)}`;
          }
        }
      }

      if (part.filename && part.filename.trim() !== "") {
        typeMap.attachments.push({
          id: part.body?.attachmentId || part.partId || `file-${Date.now()}`,
          name: part.filename,
          mimeType: part.mimeType,
          size: part.body?.size || 0,
        });
      }
      if (part.parts) part.parts.forEach(extractParts);
    };

    extractParts(msgData.payload);

    let rawBody = typeMap.html || typeMap.plain || "";
    let decodedBody = rawBody
      ? Buffer.from(rawBody.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
      : (msgData.snippet || "");

    Object.keys(typeMap.inlineImages).forEach(cid => {
      const imgSrc = typeMap.inlineImages[cid];
      const regex = new RegExp(`cid:['"]?${cid}['"]?`, "gi");
      decodedBody = decodedBody.replace(regex, imgSrc);
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify({
        ok: true,
        body: decodedBody || msgData.snippet || "",
        attachments: typeMap.attachments,
      }),
    };
  } catch (err) {
    console.error("gmail-message error:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
