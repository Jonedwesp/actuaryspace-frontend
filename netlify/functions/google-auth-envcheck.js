export async function handler() {
  const keys = Object.keys(process.env).filter(k =>
    k.startsWith("GOOGLE_") || k.startsWith("VITE_")
  ).sort();

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      foundKeys: keys,
      GOOGLE_CLIENT_ID_present: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_OAUTH_REDIRECT_present: !!process.env.GOOGLE_OAUTH_REDIRECT,
      GOOGLE_REDIRECT_URI_present: !!process.env.GOOGLE_REDIRECT_URI,
      GOOGLE_CLIENT_ID_preview: (process.env.GOOGLE_CLIENT_ID || "").slice(0, 12) + "...",
      GOOGLE_OAUTH_REDIRECT_value: process.env.GOOGLE_OAUTH_REDIRECT || null,
    }, null, 2),
  };
}