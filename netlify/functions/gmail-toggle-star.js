import { getAccessToken } from "./_google-creds.js";

async function request(urlStr, options = {}) {
  const response = await fetch(urlStr, {
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
  });
  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    json: async () => data,
  };
}

export async function handler(event) {
  const origin = event.headers.origin || event.headers.Origin || "http://localhost:8888";
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  try {
    const { messageId, starred } = JSON.parse(event.body);

    // 1. Get Access Token
    let token;
    try {
      token = await getAccessToken(event);
    } catch (e) {
      // Fallback to Env Var for Siya if cookie is missing on localhost
      if (process.env.AS_GCHAT_RT) {
        const body = new URLSearchParams({
          client_id: "255077263612-j39k16rqh685nn7sd4oh1qkn5f7eb1ls.apps.googleusercontent.com",
          client_secret: "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",
          refresh_token: process.env.AS_GCHAT_RT,
          grant_type: "refresh_token",
        });
        const resp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        const json = await resp.json();
        token = json.access_token;
      }
    }

    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ ok: false, error: "No Refresh Token found in cookies. Please re-authenticate." }),
      };
    }

    // 2. Modify Gmail Labels
    const modifyPayload = JSON.stringify({
      addLabelIds: starred ? ["STARRED"] : [],
      removeLabelIds: !starred ? ["STARRED"] : [],
    });

    const modifyRes = await request(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: modifyPayload,
      }
    );

    if (modifyRes.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    }

    const errBody = await modifyRes.json();
    return {
      statusCode: modifyRes.status || 400,
      headers,
      body: JSON.stringify({ ok: false, error: errBody.error?.message || "Gmail rejected update" }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}