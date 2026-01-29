// netlify/functions/drive-list.js
import { google } from "googleapis";
import { loadServiceAccount } from "./_google-creds.js";

export async function handler() {
  try {
    const creds = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
      q: "trashed = false",
      pageSize: 20,
      fields: "files(id, name, mimeType, parents)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, files: res.data.files || [] }, null, 2),
    };
  } catch (err) {
    console.error("Drive error (drive-list):", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}