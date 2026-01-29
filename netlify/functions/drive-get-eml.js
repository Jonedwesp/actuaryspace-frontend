// netlify/functions/drive-get-eml.js
import { google } from "googleapis";
import { loadServiceAccount } from "./_google-creds.js";

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
    const fileId = event.queryStringParameters?.id;
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing id" }),
      };
    }

    const drive = getDriveClient();

    // Download raw .eml bytes
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const data = Buffer.isBuffer(res.data)
      ? res.data
      : Buffer.from(res.data);

    const raw = data.toString("utf8");
    let bodyText = "";

    // 1) Try to grab text/plain part inside a multipart email
    const plainMatch = raw.match(
      /Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([^]*?)(?:\r?\n--[-A-Za-z0-9_]+|$)/i
    );
    if (plainMatch && plainMatch[1]) {
      bodyText = plainMatch[1].trim();
    }

    // 2) Fallback: everything after first blank line (headers → body)
    if (!bodyText) {
      const idx =
        raw.indexOf("\r\n\r\n") >= 0
          ? raw.indexOf("\r\n\r\n")
          : raw.indexOf("\n\n");

      if (idx >= 0) {
        bodyText = raw.substring(idx + 4).trim();
      }
    }

    // 3) FINAL fallback: just show the entire raw .eml
    if (!bodyText) {
      bodyText = raw || "";
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        bodyText,
      }),
    };
  } catch (err) {
    console.error("drive-get-eml error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}