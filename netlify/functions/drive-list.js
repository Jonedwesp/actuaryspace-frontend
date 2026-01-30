// netlify/functions/drive-list.js
const { JWT } = require("google-auth-library");
const { loadServiceAccount } = require("./_google-creds.cjs");

exports.handler = async function () {
  try {
    const creds = loadServiceAccount();

    const client = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    await client.authorize();

    // Drive files.list via raw HTTP
    const res = await client.request({
      url: "https://www.googleapis.com/drive/v3/files",
      method: "GET",
      params: {
        q: "trashed = false",
        pageSize: 20,
        fields: "files(id,name,mimeType,parents)",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, files: res.data.files || [] }, null, 2),
    };
  } catch (err) {
    console.error("drive-list error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message || String(err) }),
    };
  }
};