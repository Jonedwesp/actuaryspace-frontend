// netlify/functions/gchat-download.js

// Module-level token cache — Lambda instances stay warm ~15 min,
// so multiple attachments in the same session share one token fetch.
let cachedToken = null;
let tokenExpiry = 0;

async function getToken(RT, CLIENT_ID, CLIENT_SECRET) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60000) return cachedToken; // 1-min buffer

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: RT,
      grant_type: "refresh_token",
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    console.error("Token Refresh Error:", tokenJson);
    throw new Error("Auth Failed");
  }

  cachedToken = tokenJson.access_token;
  tokenExpiry = now + (tokenJson.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function handler(event) {
  let { uri } = event.queryStringParameters || {};
  if (!uri) return { statusCode: 400, body: "Missing uri" };

  const RT = process.env.AS_GCHAT_RT;
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  try {
    // 1. Get Access Token (cached per Lambda instance)
    const accessToken = await getToken(RT, CLIENT_ID, CLIENT_SECRET);

    // 2. Construct URL (Using the Media Download endpoint)
    let fetchUrl = uri;
    if (uri.startsWith("api:")) {
      const resourceName = uri.replace("api:", "");
      fetchUrl = `https://chat.googleapis.com/v1/media/${resourceName}?alt=media`;
    }

    // 3. Fetch File
    const fileRes = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!fileRes.ok) {
      const txt = await fileRes.text();
      return { statusCode: fileRes.status, body: `Fetch failed: ${txt}` };
    }

    // 4. Process File & Magic Byte Detection
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let contentType = fileRes.headers.get("content-type") || "application/octet-stream";

    const headerBytes = buffer.subarray(0, 4).toString();
    if (headerBytes === "%PDF") {
      contentType = "application/pdf";
    }

    // 5. Return Response — browser caches for 1 hour so repeated views are instant
    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*"
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: String(err) };
  }
}
