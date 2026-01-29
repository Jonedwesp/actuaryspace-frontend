// netlify/functions/drive-download.js

import { google } from "googleapis";
import { loadServiceAccount } from "./_google-creds.js";

// Same helper as in drive-get-eml.js
function getDriveClient() {
  const creds = loadServiceAccount();

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

export async function handler(event) {
  try {
    const qs = event.queryStringParameters || {};
    const fileId = qs.id;
    if (!fileId) {
      return { statusCode: 400, body: "Missing id" };
    }

    // NEW: allow name + mimeType to be passed in from the front-end
    const nameParam = qs.name;
    const mimeParam = qs.mimeType;

    const drive = getDriveClient();

    // Download raw file bytes (single Drive call)
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const data = Buffer.isBuffer(res.data)
      ? res.data
      : Buffer.from(res.data);

    // Use provided mimeType/name if available, otherwise fall back
    const mimeType = mimeParam || "application/octet-stream";
    const name = nameParam || "file";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          name
        )}"`,
      },
      body: data.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("drive-download error:", err);
    return {
      statusCode: 500,
      body: `drive-download error: ${err.message}`,
    };
  }
}