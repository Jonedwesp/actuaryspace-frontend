// netlify/functions/_google-creds.js
import fs from "fs";
import path from "path";
import * as crypto from "node:crypto";

export function loadServiceAccount() {
  const pw = process.env.SA_ENC_PASSWORD;
  if (!pw) throw new Error("Missing SA_ENC_PASSWORD env var");

  // read encrypted blob (committed in repo)
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