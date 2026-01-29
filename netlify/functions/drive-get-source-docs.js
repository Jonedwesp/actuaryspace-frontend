// netlify/functions/drive-get-source-docs.js
import { google } from "googleapis";
import fs from "fs";

function loadGoogleCreds() {
  const envJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envJson) {
    try {
      return JSON.parse(envJson);
    } catch (e) {
      console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS:", e.message);
    }
  }

  try {
    const raw = fs.readFileSync("./service-account.json", "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read ./service-account.json:", e.message);
  }

  throw new Error("No valid Google service account credentials found");
}

export async function handler() {
  try {
    const creds = loadGoogleCreds();

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