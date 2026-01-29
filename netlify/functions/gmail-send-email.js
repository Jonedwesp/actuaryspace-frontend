// netlify/functions/gmail-send-email.js
// Sends email via Gmail API using a service account with domain-wide delegation.
// From address is taken from process.env.GMAIL_IMPERSONATE (e.g. namir@actuaryconsulting.co.za)

import { JWT } from "google-auth-library";
import { loadServiceAccount } from "./_google-creds.js";

// Helper: turn MIME string into base64url (required by Gmail API)
function toBase64Url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// Helper: normalise a "to" string into comma-separated emails
// Accepts "a@x.com, b@y.com" or "a@x.com; b@y.com"
function normaliseRecipients(toRaw) {
  if (!toRaw) return "";
  return toRaw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

// Build an HTML (Verdana) MIME message
// Build a multipart/alternative MIME message: plain-text + HTML (Verdana)
function createMimeMessage({ from, to, subject, body }) {
  const textBody = body || "";

  const safeHtmlBody = (body || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const htmlBody = `<div style="font-family: Verdana, Geneva, sans-serif; font-size:14px; line-height:1.5;">
${safeHtmlBody}
</div>`;

  const boundary = "mixed_" + Date.now();

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    textBody,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
    `--${boundary}--`,
    "",
  ];

  // Gmail wants CRLF line endings everywhere
  return lines.join("\r\n");
}

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  try {
    const rawBody = event.body || "{}";
    const payload = JSON.parse(rawBody);

    let { to, subject, body } = payload;

    if (!to || !String(to).trim()) {
      throw new Error("Missing 'to' in request body");
    }

    subject = subject || "(no subject)";
    body = body || "";

    // ✅ load service account from file/short env (NOT huge JSON env)
    const sa = loadServiceAccount();

    // ✅ who we are sending "as"
    const impersonate = process.env.GMAIL_IMPERSONATE;
    if (!impersonate) {
      throw new Error("GMAIL_IMPERSONATE env var is not set");
    }

    // ✅ create Gmail client
    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
      subject: impersonate,
    });

    // ✅ authorize token
    await client.authorize();

    const toHeader = normaliseRecipients(to);
    const fromHeader = impersonate;

    const mime = createMimeMessage({
      from: fromHeader,
      to: toHeader,
      subject,
      body,
    });

    const raw = toBase64Url(mime);

    // Send via Gmail API
    const url =
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    const res = await client.request({
      url,
      method: "POST",
      data: { raw },
    });

    const data = res.data || {};

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        id: data.id || null,
        labelIds: data.labelIds || [],
      }),
    };
  } catch (err) {
    console.error("gmail-send-email error:", err);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: false,
        error: err.message || String(err),
      }),
    };
  }
}