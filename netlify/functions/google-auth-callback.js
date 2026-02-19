// netlify/functions/google-auth-callback.js

function parseState(stateB64) {
  if (!stateB64) return null;
  try {
    const json = Buffer.from(stateB64, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch { return null; }
}

function cookie(name, value, opts = {}) {
  const { path = "/", httpOnly = true, secure = true, sameSite = "Lax", maxAge } = opts;
  let out = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) out += "; HttpOnly";
  if (secure) out += "; Secure";
  if (typeof maxAge === "number") out += `; Max-Age=${maxAge}`;
  return out;
}

export async function handler(event) {
  const qs = event.queryStringParameters || {};
  const code = qs.code;
  const stateRaw = qs.state;

  if (!code) return { statusCode: 400, body: "Missing ?code" };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;

  if (!clientId || !clientSecret || !redirectUri) {
    return { statusCode: 500, body: "Missing Google Credentials in Netlify Env" };
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("redirect_uri", redirectUri);
  body.set("grant_type", "authorization_code");

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = await resp.json().catch(() => ({}));
  if (!resp.ok) return { statusCode: 500, body: `Token Error: ${JSON.stringify(tokenJson)}` };

  const accessToken = tokenJson.access_token || "";
  const refreshToken = tokenJson.refresh_token || "";
  const expiresIn = Number(tokenJson.expires_in || 3600);

  const headers = [];
  if (accessToken) headers.push(cookie("AS_GCHAT_AT", accessToken, { maxAge: expiresIn }));
  if (refreshToken) headers.push(cookie("AS_GCHAT_RT", refreshToken, { maxAge: 60 * 60 * 24 * 120 }));
  headers.push(cookie("AS_GCHAT_OK", "1", { maxAge: 60 * 60 * 24 * 120, httpOnly: false }));

  // --- REPLACED REDIRECT WITH SUCCESS PAGE ---
  return {
    statusCode: 200,
    multiValueHeaders: { "Set-Cookie": headers },
    headers: { "Content-Type": "text/html" },
    body: `
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h2 style="color: #0F9D58;">✓ Connection Successful!</h2>
          <p>ActuarySpace is now linked to your Google Account.</p>
          <script>
            // Refreshes the main window behind this popup
            if (window.opener) { window.opener.location.reload(); }
            // Closes this popup automatically
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `,
  };
}