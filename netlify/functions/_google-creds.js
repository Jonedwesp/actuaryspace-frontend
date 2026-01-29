// netlify/functions/_google-creds.js
import fs from "fs";
import path from "path";

export function loadServiceAccount() {
  // service-account.json is at repo root, and included_files ships it with functions
  const p = path.join(process.cwd(), "service-account.json");
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}