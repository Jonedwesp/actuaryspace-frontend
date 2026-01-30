// netlify/functions/drive-get-emails.js
import { getAccessToken } from "./_sa-token.js";

export async function handler() {
  try {
    const token = await getAccessToken([
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/gmail.readonly",
    ]);

    // Folder that contains .eml files (same one you already use)
    const FOLDER_ID = "1dq6UPOHMnzD--fFqWts6VTir4mEpPcsq";

    // 1️⃣ List EML files from Drive
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,parents)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!listRes.ok) {
      throw new Error(`Drive list failed: ${await listRes.text()}`);
    }

    const listJson = await listRes.json();
    const files = listJson.files || [];

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, files }, null, 2),
    };
  } catch (err) {
    console.error("drive-get-emails error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}