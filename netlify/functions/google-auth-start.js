// netlify/functions/google-auth-start.js
export async function handler(event) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;

    if (!clientId || !redirectUri) {
      return {
        statusCode: 500,
        body: "Missing GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT in env",
      };
    }

    const state = encodeURIComponent(
      JSON.stringify({
        ts: Date.now(),
        // later we can add: userId, returnTo, etc.
      })
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline", // gives refresh_token (important)
      prompt: "consent",      // force refresh_token on first connect
      include_granted_scopes: "true",
      state,

      // Scopes for Chat read/write
      scope: [
        "https://www.googleapis.com/auth/chat.messages",
        "https://www.googleapis.com/auth/chat.spaces",
        "https://www.googleapis.com/auth/chat.memberships",
        "openid",
        "email",
        "profile",
      ].join(" "),
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return {
      statusCode: 302,
      headers: {
        Location: url,
        "Cache-Control": "no-store",
      },
      body: "",
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: `google-auth-start error: ${err?.message || String(err)}`,
    };
  }
}