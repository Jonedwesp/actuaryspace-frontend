// netlify/functions/_sa-token.js
import crypto from "node:crypto";
import { loadServiceAccount } from "./_google-creds.js";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function getAccessToken(scopes = [], userToImpersonate = null) {
  const sa = loadServiceAccount();

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  if (userToImpersonate) {
    claim.sub = userToImpersonate;
  }

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claim)
  )}`;

  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsigned), sa.private_key)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token error (${res.status}): ${JSON.stringify(data)}`);
  }

  return data.access_token;
}