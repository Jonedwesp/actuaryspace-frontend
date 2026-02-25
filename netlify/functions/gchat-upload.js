import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  // 1. Log Start
  console.log("🚀 [gchat-upload] Function started.");

  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // 2. Body Parsing
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

    // 3. Authenticate (Uses Siya's identity from cookies)
    console.log("🔄 [gchat-upload] Getting user access token...");
    const accessToken = await getAccessToken(event);

    // 4. Decode File
    console.log("🛠 [gchat-upload] decoding buffer...");
    const fileBuffer = Buffer.from(fileBase64, "base64");
    console.log(`🛠 [gchat-upload] Buffer size: ${fileBuffer.length} bytes`);

    // 5. Upload to Google
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
        text: body.text || "", 
        attachment: [
          { attachmentDataRef: attachmentDataRef }
        ]
      }),
    });

    const msgJson = await msgRes.json();
    return json(200, { ok: true, message: msgJson });

  } catch (err) {
    console.error("🔥 [gchat-upload] CRASH:", err.message);
    const isAuthError = err.message.includes("No Refresh Token");
    return json(isAuthError ? 401 : 500, { ok: false, error: err.message });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    },
    body: JSON.stringify(body),
  };
}