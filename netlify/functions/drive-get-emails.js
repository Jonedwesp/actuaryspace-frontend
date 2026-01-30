// netlify/functions/drive-get-emails.js
import { JWT } from "google-auth-library";
import { loadServiceAccount } from "./_google-creds.js";

const EMAIL_FOLDER_ID = "1bpvc1e2VbtHsyrEDdzJANYNXDUp0Qr2l";

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(obj),
  };
}

// Extract Subject from raw .eml (works even if extra headers exist)
function extractSubject(raw, fallbackName = "") {
  const m = raw.match(/^Subject:\s*(.*)$/mi);
  if (m && m[1]) return m[1].trim();
  return fallbackName.replace(/\.eml$/i, "") || "Client Instruction (Data Centre)";
}

export async function handler() {
  try {
    const sa = loadServiceAccount();

    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    await client.authorize();

    // 1) List .eml files inside EMAIL_FOLDER_ID
    const q = `'${EMAIL_FOLDER_ID}' in parents and trashed = false and mimeType = 'message/rfc822'`;

    const listRes = await client.request({
      url: "https://www.googleapis.com/drive/v3/files",
      method: "GET",
      params: {
        q,
        pageSize: 10,
        fields: "files(id,name)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      },
    });

    const files = listRes.data?.files || [];
    const withSubjects = [];

    // 2) Download each .eml and parse Subject
    for (const f of files) {
      try {
        const emlRes = await client.request({
          url: `https://www.googleapis.com/drive/v3/files/${f.id}`,
          method: "GET",
          params: { alt: "media" },
          responseType: "arraybuffer",
        });

        const raw = Buffer.from(emlRes.data).toString("utf8");
        const subject = extractSubject(raw, f.name);

        withSubjects.push({ id: f.id, name: f.name, subject });
      } catch (e) {
        withSubjects.push({
          id: f.id,
          name: f.name,
          subject: f.name.replace(/\.eml$/i, ""),
        });
      }
    }

    return resp(200, { ok: true, files: withSubjects });
  } catch (err) {
    console.error("drive-get-emails error:", err);
    return resp(500, { ok: false, error: err.message || String(err) });
  }
}