// netlify/functions/drive-get-email-body.js
import { google } from "googleapis";
import { simpleParser } from "mailparser";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function getDriveClient() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON env var is missing");
  }

  const creds = JSON.parse(raw);

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: SCOPES,
  });

  return google.drive({ version: "v3", auth });
}

export async function handler(event) {
  try {
    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Missing id" }),
      };
    }

    const drive = getDriveClient();

    // Download raw .eml bytes
    const res = await drive.files.get(
      { fileId: id, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const rawEml = Buffer.from(res.data).toString("utf8");

    // Parse the .eml
    const parsed = await simpleParser(rawEml);

    const result = {
      ok: true,
      id,
      subject: parsed.subject || "",
      from: (parsed.from && parsed.from.text) || "",
      to: (parsed.to && parsed.to.text) || "",
      date: parsed.date || null,
      text: parsed.text || "",
      html: parsed.html || "",
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("drive-get-email-body error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}