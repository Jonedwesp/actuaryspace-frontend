// netlify/functions/gchat-download.js

export async function handler(event) {
  let { uri } = event.queryStringParameters || {};
  if (!uri) return { statusCode: 400, body: "Missing uri" };

  const RT = process.env.AS_GCHAT_RT; // Ensure this is the new "Siya Token"
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  try {
    // 1. Get Access Token
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
        return { statusCode: 502, body: "Auth Failed" };
    }
    const accessToken = tokenJson.access_token;

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
    
    // Default to what Google says, but fallback to octet-stream
    let contentType = fileRes.headers.get("content-type") || "application/octet-stream";

    // 🕵️‍♂️ MAGIC FIX: Check file signature to force PDF
    // If Google says "octet-stream" but the file starts with "%PDF", force correct type.
    const headerBytes = buffer.subarray(0, 4).toString(); 
    if (headerBytes === "%PDF") {
        contentType = "application/pdf";
    }

    // 5. Return Response
    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline", // 👈 Tells browser: "Show this, don't save it"
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*" // Allow frontend to fetch this
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: String(err) };
  }
}