// netlify/functions/drive-debug-root.js

import { google } from "googleapis";
import { loadServiceAccount } from "./_google-creds.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";

// 👇 ROOT = Clients folder (hard-coded, no env)
const DATA_CENTRE_ROOT_ID = "1hu-GGFToK1cNdjXP-qrAYM2V_Ov5zYtW";

function getDriveClient() {
  const creds = loadServiceAccount();

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

export async function handler() {
  try {
    console.log("DEBUG drive-debug-root DATA_CENTRE_ROOT_ID =", DATA_CENTRE_ROOT_ID);

    const drive = getDriveClient();

    const res = await drive.files.list({
      q: `'${DATA_CENTRE_ROOT_ID}' in parents AND trashed = false`,
      fields: "files(id, name, mimeType)",
      pageSize: 100,
    });

    const files = res.data.files || [];

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          version: "debug-v3",
          rootId: DATA_CENTRE_ROOT_ID,
          count: files.length,
          items: files.map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
          })),
        },
        null,
        2
      ),
    };
  } catch (err) {
    console.error("drive-debug-root error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}