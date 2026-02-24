import fs from "fs";
import path from "path";
import * as crypto from "node:crypto";

export function loadServiceAccount() {
  const pw = process.env.SA_ENC_PASSWORD;
  if (!pw) throw new Error("Missing SA_ENC_PASSWORD env var");

  const encPath = path.join(
   process.cwd(),
   "netlify/functions/service-account.enc.json"
  );
  const encRaw = fs.readFileSync(encPath, "utf8");
  const blob = JSON.parse(encRaw);

  const salt = Buffer.from(blob.salt, "base64");
  const iv = Buffer.from(blob.iv, "base64");
  const tag = Buffer.from(blob.tag, "base64");
  const data = Buffer.from(blob.data, "base64");

  const key = crypto.pbkdf2Sync(pw, salt, blob.iter || 100000, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plain);
}

/**
 * NEW: getAccessToken 
 * This function handles the User OAuth flow. 
 * It reads the 'event' to find the Refresh Token cookie.
 */
export async function getAccessToken(event) {
  const cookieHeader = (event && event.headers && event.headers.cookie) || "";
  
  // Look for the AS_GCHAT_RT cookie
  const match = cookieHeader.match(/AS_GCHAT_RT=([^;]+)/);
  const refreshToken = match ? match[1] : null;

  if (!refreshToken) {
    throw new Error("No Refresh Token found in cookies. Please re-authenticate at /google-auth-start");
  }

  const clientId = "255077263612-j39k16rqh685nn7sd4oh1qkn5f7eb1ls.apps.googleusercontent.com";
  const clientSecret = "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";

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decodeURIComponent(refreshToken),
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Token Refresh Failed: ${JSON.stringify(data)}`);
  
  return data.access_token;
}