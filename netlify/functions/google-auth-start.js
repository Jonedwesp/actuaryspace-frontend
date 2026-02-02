// netlify/functions/google-auth-start.js
export async function handler(event) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT; // ✅ confirmed by envcheck

    if (!clientId || !redirectUri) {
      return {
        statusCode: 500,
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({
          ok: false,
          error: "Missing GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT in env",
          hasClientId: Boolean(clientId),
          hasRedirect: Boolean(redirectUri),
        }),
      };
    }

    const state = Buffer.from(
      JSON.stringify({ ts: Date.now() })
    ).toString("base64url");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",

      // IMPORTANT: refresh token
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",

      state,

      // Google Chat + identity
      scope: [
        "https://www.googleapis.com/auth/chat.messages",
        "https://www.googleapis.com/auth/chat.spaces",
        "https://www.googleapis.com/auth/chat.memberships",
        "openid",
        "email",
        "profile",
      ].join(" "),
    });

    return {
      statusCode: 302,
      headers: {
        Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        "Cache-Control": "no-store",
      },
      body: "",
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Cache-Control": "no-store" },
      body: `google-auth-start error: ${err?.message || String(err)}`,
    };
  }
}