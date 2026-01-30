// netlify/functions/drive-list.js
import fetch from "node-fetch";
import { loadServiceAccount } from "./_google-creds.js";
import { JWT } from "google-auth-library";

export async function handler() {
  try {
    const creds = loadServiceAccount();

    const client = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const token = await client.authorize();

    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=trashed=false&pageSize=20&fields=files(id,name,mimeType,parents)",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      }
    );

    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, files: data.files || [] }),
    };
  } catch (err) {
    console.error("Drive error (drive-list):", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}