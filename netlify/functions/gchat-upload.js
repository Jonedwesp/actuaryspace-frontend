export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "POST only" });
    }

    const body = safeJson(event.body);
    let space = String(body?.space || "").trim();
    const filename = String(body?.filename || "file").trim();
    const mimeType = String(body?.mimeType || "application/octet-stream").trim();
    const fileBase64 = String(body?.fileBase64 || "");
    const text = String(body?.text || "").trim();

    if (!space) return json(400, { ok: false, error: "Missing body.space" });
    if (!fileBase64) return json(400, { ok: false, error: "Missing body.fileBase64" });

    // Clean space ID
    space = space.replace(/^\/+/, "");
    space = space.replace(/\/messages\/?$/i, "");
    if (!space.startsWith("spaces/")) space = `spaces/${space}`;

    // Auth (same as gchat-send)
    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW || !CLIENT_ID || !CLIENT_SECRET) {
      return json(500, { ok: false, error: "Missing env vars" });
    }

    const RT = decodeURIComponent(RT_RAW);
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
    
    if (!tokenRes.ok) return json(502, { ok: false, error: "Auth failed" });
    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    // 1. Upload Media
    const uploadUrl = `https://chat.googleapis.com/upload/v1/${encodeURI(space)}/attachments:upload?uploadType=media&filename=${encodeURIComponent(filename)}`;
    const fileBuffer = Buffer.from(fileBase64, "base64");

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType,
        "Content-Length": fileBuffer.length,
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      return json(502, { ok: false, error: "Media upload failed", details: txt });
    }

    const uploadJson = await uploadRes.json();
    const attachmentDataRef = uploadJson.attachmentDataRef;

    // 2. Create Message with Attachment
    const msgUrl = `https://chat.googleapis.com/v1/${encodeURI(space)}/messages`;
    const msgBody = {
      text: text, // can be empty if just sending file
      attachmentUpload: { attachmentDataRef },
    };

    const msgRes = await fetch(msgUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msgBody),
    });

    const msgJson = await msgRes.json();

    if (!msgRes.ok) {
      return json(502, { ok: false, error: "Message creation failed", details: msgJson });
    }

    return json(200, { ok: true, message: msgJson });

  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}