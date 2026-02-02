// netlify/functions/google-oauth-callback.js

export async function handler(event) {
  const qs = event.queryStringParameters || {};
  const { code, state, scope, error } = qs;

  console.log("[OAUTH CALLBACK] hit", {
    hasCode: !!code,
    state,
    error,
    scopePreview: (scope || "").slice(0, 120),
  });

  if (error) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ ok: false, error, qs }),
    };
  }

  if (!code) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ ok: false, error: "Missing ?code", qs }),
    };
  }

  // ✅ Stub success (next step will exchange code for tokens)
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      ok: true,
      message: "Callback function reached. Next step is token exchange.",
      gotCodePreview: String(code).slice(0, 18) + "...",
      state,
    }),
  };
}