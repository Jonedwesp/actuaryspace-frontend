// netlify/functions/gchat-upload.js
import dotenv from "dotenv";
dotenv.config();

export async function handler(event) {
  // 1. Log Start
  console.log("🚀 [gchat-upload] Function started.");

  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // 2. Log Body Parsing
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      console.error("❌ [gchat-upload] JSON Parse failed. Body too large?");
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    const { space, filename, mimeType, fileBase64 } = body;

    if (!space || !fileBase64) {
      console.error("❌ [gchat-upload] Missing space or fileBase64.");
      return json(400, { ok: false, error: "Missing space or file data" });
    }

    console.log(`📦 [gchat-upload] File: ${filename}, Size (Base64): ${fileBase64.length} chars`);

    const RT = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT) return json(400, { ok: false, error: "Missing AS_GCHAT_RT" });

    // 3. Authenticate
    console.log("🔄 [gchat-upload] Refreshing token...");
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
      console.error("❌ [gchat-upload] Auth failed:", tokenJson);
      return json(502, { ok: false, error: "Auth failed", details: tokenJson });
    }
    const accessToken = tokenJson.access_token;

    // 4. Decode File
    console.log("🛠 [gchat-upload] decoding buffer...");
    const fileBuffer = Buffer.from(fileBase64, "base64");
    console.log(`🛠 [gchat-upload] Buffer size: ${fileBuffer.length} bytes`);

    // 5. Upload to Google
    // Ensure space ID is clean (some APIs want "spaces/AAA", some want "AAA")
    // The upload API expects: https://chat.googleapis.com/upload/v1/spaces/{SPACE_ID}/attachments:upload
    
    // Note: If 'space' already contains 'spaces/', we use it as is.
    const uploadUrl = `https://chat.googleapis.com/upload/v1/${space}/attachments:upload?filename=${encodeURIComponent(filename)}`;
    
    console.log(`📤 [gchat-upload] POSTing to ${uploadUrl}`);

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Length": fileBuffer.length.toString(),
      },
      body: fileBuffer,
    });

    const uploadJson = await uploadRes.json().catch(err => ({ error: "JSON Parse Error on Google Resp", raw: err }));
    
    console.log("📥 [gchat-upload] Google Response:", JSON.stringify(uploadJson).slice(0, 200));

    if (!uploadJson.attachmentDataRef) {
      console.error("❌ [gchat-upload] Upload failed. Response:", uploadJson);
      return json(502, { ok: false, error: "Media upload failed", details: uploadJson });
    }

    const attachmentDataRef = uploadJson.attachmentDataRef;
    console.log("✅ [gchat-upload] Upload Success! Sending Message...");

    // 6. Send Message with Attachment
    const msgUrl = `https://chat.googleapis.com/v1/${space}/messages`;
    const msgRes = await fetch(msgUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: body.text || "", // Optional caption
        attachment: [
          { attachmentDataRef: attachmentDataRef }
        ]
      }),
    });

    const msgJson = await msgRes.json();
    return json(200, { ok: true, message: msgJson });

  } catch (err) {
    console.error("🔥 [gchat-upload] CRASH:", err);
    return json(500, { ok: false, error: String(err) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}