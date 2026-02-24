import fs from "fs";
import path from "path";
import * as crypto from "node:crypto";

// 1. Keep your decryption logic if you use the Service Account elsewhere
export function loadServiceAccount() {
  const pw = process.env.SA_ENC_PASSWORD;
  if (!pw) throw new Error("Missing SA_ENC_PASSWORD env var");
  const encPath = path.join(process.cwd(), "netlify/functions/service-account.enc.json");
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

// 2. NEW: Function to refresh your User Token using your cookies
export async function getAccessToken(event) {
  // Extract the Refresh Token from the cookies you set in the callback
  const cookies = event.headers.cookie || "";
  const refreshToken = cookies.split('; ').find(row => row.startsWith('AS_GCHAT_RT='))?.split('=')[1];

  if (!refreshToken) {
    throw new Error("No Refresh Token found. Please log in again.");
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
  if (!response.ok) throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);

  return data.access_token;
}