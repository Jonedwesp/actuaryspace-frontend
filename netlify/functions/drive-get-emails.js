// netlify/functions/drive-get-emails.js
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

// 👇 Email folder for ONE demo case
const EMAIL_FOLDER_ID = "1bpvc1e2VbtHsyrEDdzJANYNXDUp0Qr2l";

export async function handler() {
  try {
    const drive = getDriveClient();

    const list = await drive.files.list({
      q: `'${EMAIL_FOLDER_ID}' in parents and trashed = false and mimeType = 'message/rfc822'`,
      fields: "files(id, name)",
      pageSize: 10,
    });

    const files = list.data.files || [];
    const withSubjects = [];

    for (const f of files) {
      try {
        const res = await drive.files.get(
          { fileId: f.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const raw = Buffer.from(res.data).toString("utf8");

        const m = raw.match(/^Subject:\s*(.*)$/mi);
        const subject = m
          ? m[1].trim()
          : f.name.replace(/\.eml$/i, "") || "Client Instruction (Data Centre)";

        withSubjects.push({
          id: f.id,
          name: f.name,
          subject,
        });
      } catch (err) {
        console.error("subject parse failed for", f.id, err);
        withSubjects.push({
          id: f.id,
          name: f.name,
          subject: f.name.replace(/\.eml$/i, ""),
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, files: withSubjects }),
    };
  } catch (err) {
    console.error("drive-get-emails error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}