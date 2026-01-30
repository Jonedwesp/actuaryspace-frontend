// netlify/functions/_google-creds.cjs
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadServiceAccount() {
  const pw = process.env.SA_ENC_PASSWORD;
  if (!pw) throw new Error("Missing SA_ENC_PASSWORD env var");

  // service-account.enc.json is in the same folder as this file at runtime
  const encPath = path.join(__dirname, "service-account.enc.json");
  const blob = JSON.parse(fs.readFileSync(encPath, "utf8"));

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

module.exports = { loadServiceAccount };