import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    // 🛡️ IDENTITY FIX: Uses the Hard-Link token if cookies are missing
    const accessToken = await getAccessToken(event);

    // -----------------------------------------------------------------
    // SEARCH OR CREATE LOGIC (For starting new Direct Messages)
    // -----------------------------------------------------------------
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      let targetEmail = body.email;

      if (!targetEmail) return json(400, { ok: false, error: "Email required" });

      // 🛡️ EMAIL HARDENING: Remove accidental spaces and ensure lowercase
      targetEmail = targetEmail.trim().toLowerCase();

      const setupUrl = "https://chat.googleapis.com/v1/spaces:setup";
      const setupRes = await fetch(setupUrl, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          space: { spaceType: "DIRECT_MESSAGE" },
          memberships: [{
            member: { 
              name: `users/${targetEmail}`, 
              type: "HUMAN" 
            }
          }]
        })
      });

      const setupData = await setupRes.json();
      
      if (!setupRes.ok) {
        // 🛡️ ENHANCED LOGGING: Jonathan can now see the EXACT reason for "User not found"
        console.error("GCHAT SETUP FAIL:", {
          status: setupRes.status,
          target: targetEmail,
          details: setupData
        });
        return json(setupRes.status, { ok: false, error: setupData.error?.message || "User not found" });
      }

      return json(200, { ok: true, space: setupData });
    }
    // -----------------------------------------------------------------

    // 2. List Spaces (Populates your Sidebar list)
    const url = new URL("https://chat.googleapis.com/v1/spaces");
    url.searchParams.set("pageSize", "100"); // Reduced page size to avoid timeout
    // 🛡️ REFINED FIELDS: Only request fields guaranteed to exist to avoid 500 errors
    url.searchParams.set("fields", "spaces(name,displayName,spaceType,createTime,lastActiveTime),nextPageToken");

    const res = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      console.error("LIST SPACES FAIL:", data);
      return json(502, { ok: false, where: "list-spaces", data });
    }

    const rawSpaces = data.spaces || [];

    // 🚀 OPTIMIZED: Only fetch read state for recently active spaces (last 7 days)
    // This reduces API calls from ~100 to ~10-20, dramatically improving load time.
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const spacesWithReadState = await Promise.all(rawSpaces.map(async (s) => {
      const spaceName = s.name; // e.g. "spaces/AAAA..."
      const lastActive = s.lastActiveTime || s.createTime;
      const lastActiveMs = lastActive ? new Date(lastActive).getTime() : 0;

      // Skip read state API call for inactive spaces — treat as fully read
      if (lastActiveMs < sevenDaysAgo) {
        return {
          id: spaceName,
          displayName: s.displayName || "",
          type: s.spaceType,
          createTime: s.createTime || null,
          lastActiveTime: lastActive,
          serverLastReadTime: lastActive // Treated as read
        };
      }

      try {
        const rsUrl = `https://chat.googleapis.com/v1/users/me/${spaceName}/spaceReadState`;
        const rsRes = await fetch(rsUrl, {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });
        const rsData = await rsRes.json();
        return {
          id: spaceName,
          displayName: s.displayName || "",
          type: s.spaceType,
          createTime: s.createTime || null,
          lastActiveTime: lastActive,
          serverLastReadTime: rsData.lastReadTime || s.createTime
        };
      } catch (e) {
        console.warn(`ReadState fetch failed for ${spaceName}:`, e.message);
        return {
          id: spaceName,
          displayName: s.displayName || "",
          type: s.spaceType,
          createTime: s.createTime || null,
          lastActiveTime: lastActive,
          serverLastReadTime: s.createTime
        };
      }
    }));

    return json(200, { ok: true, spaces: spacesWithReadState });

  } catch (err) {
    console.error("GCHAT-SPACES ERROR:", err.message);
    const isAuthError = err.message.includes("No Refresh Token");
    return json(isAuthError ? 401 : 500, { ok: false, error: err.message });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache"
    },
    body: JSON.stringify(body),
  };
}