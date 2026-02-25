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

export async function getAccessToken(event) {
  // 1. Extract cookie from any possible header name (Netlify case-sensitivity fix)
  const cookieHeader = event.headers.cookie || event.headers.Cookie || event.multiValueHeaders?.Cookie?.[0] || "";
  
  // 2. Extract the Refresh Token (RT)
  const match = cookieHeader.match(/AS_GCHAT_RT=([^;]+)/);
  let refreshToken = match ? match[1].trim() : null;

  // 🛡️ Silent Guard: If no token, throw a specific message we can catch in whoami.js
  if (!refreshToken) {
    throw new Error("No Refresh Token found in cookies. Please re-authenticate.");
  }

  // 3. 🛡️ SECURITY FIX: Fully decode the token (turns %2F back into /)
while (refreshToken.includes("%")) {
    refreshToken = decodeURIComponent(refreshToken);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "255077263612-j39k16rqh685nn7sd4oh1qkn5f7eb1ls.apps.googleusercontent.com",
      client_secret: "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",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Google Token Exchange Failed:", JSON.stringify(data));
    throw new Error(data.error_description || "Failed to refresh Google token.");
  }

  return data.access_token;
}