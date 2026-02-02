// netlify/functions/google-oauth-callback.js

export async function handler(event) {
  const qs = event.queryStringParameters || {};
  const { code, error } = qs;

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT;

  // Where to send the user after OAuth finishes
  // (set this in Netlify env for Siya site)
  const POST_AUTH_REDIRECT =
    process.env.GOOGLE_POST_AUTH_REDIRECT || "https://siya.actuaryspace.co.za/";

  if (error) {
    return json(400, { ok: false, error, qs });
  }

  if (!code) {
    return json(400, { ok: false, error: "Missing ?code", qs });
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return json(500, {
      ok: false,
      error: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_REDIRECT",
      have: {
        GOOGLE_CLIENT_ID: !!CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!CLIENT_SECRET,
        GOOGLE_OAUTH_REDIRECT: !!REDIRECT_URI,
      },
    });
  }

  try {
    // Exchange code -> tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenJson = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok) {
      return json(502, {
        ok: false,
        error: "Token exchange failed",
        status: tokenRes.status,
        tokenJson,
      });
    }

    const accessToken = tokenJson.access_token || "";
    const refreshToken = tokenJson.refresh_token || ""; // only present on first consent (usually)
    const expiresIn = Number(tokenJson.expires_in || 0);

    // Store tokens in secure cookies (HttpOnly so JS can't read them)
    // NOTE: refresh_token might be empty if Google didn't return it (we'll handle that next if it happens).
    const cookieParts = [];

    if (accessToken) {
      cookieParts.push(
        cookie("AS_GCHAT_AT", accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          path: "/",
          maxAge: Math.max(60, expiresIn - 30), // slightly shorter than token life
        })
      );
    }

    if (refreshToken) {
      cookieParts.push(
        cookie("AS_GCHAT_RT", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          path: "/",
          // long-lived cookie (Google refresh tokens are long-lived unless revoked)
          maxAge: 60 * 60 * 24 * 120, // 120 days
        })
      );
    }

    // Optional: store when connected
    cookieParts.push(
      cookie("AS_GCHAT_OK", "1", {
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 120,
      })
    );

    // Redirect back to your app
    return {
      statusCode: 302,
      headers: {
        Location: POST_AUTH_REDIRECT + "?google=connected",
        "Set-Cookie": cookieParts,
        "Cache-Control": "no-store",
      },
      body: "",
    };
  } catch (e) {
    return json(500, { ok: false, error: e?.message || String(e) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function cookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  if (opts.httpOnly) parts.push("HttpOnly");

  return parts.join("; ");
}