// netlify/functions/google-oauth-callback.js

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
  if (!code) return { statusCode: 400, body: "Missing ?code" };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // UPDATE: Hard-coding the 'o' version here as well
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = await resp.json().catch(() => ({}));
  if (!resp.ok) return { statusCode: 500, body: `Token Error: ${JSON.stringify(tokenJson)}` };

  const accessToken = tokenJson.access_token || "";
  const headers = [
    cookie("AS_GCHAT_AT", accessToken, { maxAge: Number(tokenJson.expires_in || 3600) }),
    cookie("AS_GCHAT_OK", "1", { maxAge: 10368000, httpOnly: false })
  ];

  // UPDATE: Replacing the redirect with a Success popup that refreshes your site
  return {
    statusCode: 200,
    multiValueHeaders: { "Set-Cookie": headers },
    headers: { "Content-Type": "text/html" },
    body: `
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h2 style="color: #0F9D58;">✓ Connection Successful!</h2>
          <p>The "Staff Badge" is now active. ActuarySpace is linked.</p>
          <script>
            if (window.opener) { window.opener.location.reload(); }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `,
  };
}