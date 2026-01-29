// netlify/functions/drive-get-source-docs.js
import { loadServiceAccount } from "./_google-creds.js";
import { google } from "googleapis";

export async function handler() {
  try {
    const creds = loadServiceAccount();

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    // 👇 Instructions & Source Docs folder for that same demo case
    const SOURCE_FOLDER_ID = "1T1Xt2gw7J5S9225kVLKKaJn9BmvAYHaY";
    
    const res = await drive.files.list({
      q: `'${SOURCE_FOLDER_ID}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: "files(id, name, mimeType, parents, thumbnailLink, webViewLink)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, files: res.data.files }, null, 2),
    };
  } catch (err) {
    console.error("Drive error (source-docs):", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}