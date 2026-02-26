// netlify/functions/gchat-dm-name.js

// 1. SIYA'S ID (Hardcoded for stability)
const SIYA_ID = "116712532865547233135";

// 2. THE MASTER LIST (Map IDs to Clean Names)
const KNOWN_USERS = {
  "users/109833975621386956073": "Jonathan Espanol",
  "users/116928759608148752435": "Simoné Streicher",
  "users/101273447946115685891": "Tiffany Harzon-Cuyler",
  "users/110481684541592719996": "Albert Grobler",
  "users/103060225088465733197": "Tinashe Chikwamba",
  "users/105158373279991959375": "Ethan Maburutse",
  "users/112681921793658298066": "Miné Moolman",
  "users/114609724339659491302": "Bianca Wiid",
  "users/100183703799963986718": "Alicia Oberholzer",
  "users/106094639157491328183": "Leonah Marewangepo",
  "users/100973980027446317396": "Eugene Cloete",
  "users/101954867987984084170": "Alicia Kotzé",
  "users/108929714281084389788": "Songeziwe Chiya",
  "users/110745530036003772233": "Bonisa Mqonqo",
  "users/100710383419487896813": "Cameron Curtis",
  "users/104310623309718505350": "Shamiso Hapaguti",
  "users/113565695109176296608": "Waldo Jenkins",
  "users/108628384720735354945": "Melvin Smith",
  "users/115863503558522206541": "Yolandie",
  "users/105726015150067918055": "Enock Kazembe",
  "users/114022848581179253421": "Matthew Darch",
  "users/104654529926543347255": "Martin Otto", 
  "users/111372729949487816593": "Melokuhle Mabuza",
"users/113385769871096416574": "Willem Havenga",
"users/103669371912398598964": "Jennifer Mouton",
"users/117489264027903000976": "Conah MacFarlane",
"users/112422887282158931745": "Repository",
"users/117124449099034019701": "Robyn Anderson",
"users/112417469383977278282": "Siyolise Mazwi",
};

export async function handler(event) {
  try {
    let space = event.queryStringParameters?.space;
    if (!space) return json(400, { ok: false, error: "Missing space" });

    space = decodeURIComponent(space);

    const RT_RAW = process.env.AS_GCHAT_RT;
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!RT_RAW) return json(400, { ok: false, error: "Missing credentials" });

    const RT = decodeURIComponent(RT_RAW);

    // 1. Get Access Token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: RT,
        grant_type: "refresh_token",
      }),
    });
    
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      return json(502, { ok: false, error: "Token refresh failed" });
    }
    const accessToken = tokenJson.access_token;

    // 2. Fetch Members
    const membersUrl = `https://chat.googleapis.com/v1/${space}/members?pageSize=100&fields=memberships(member(name,type,displayName))`;
    
    const memRes = await fetch(membersUrl, { 
      headers: { Authorization: `Bearer ${accessToken}` } 
    });
    const memJson = await memRes.json().catch(() => ({}));
    const memberships = memJson.memberships || memJson.members || [];

    // 3. Find the "Other" Human
    let foundLabel = ""; 
    
    for (const m of memberships) {
      const u = m.member;
      if (!u || u.type !== "HUMAN") continue;

      // Clean the ID (remove "users/" or "spaces/..." garbage)
      const uNameRaw = u.name || "";
      const uIdClean = uNameRaw.split("/").pop(); // e.g. "1057..."
      const userKey = `users/${uIdClean}`;

      // 🛑 SKIP SIYA (Strict ID Match)
      if (uIdClean === SIYA_ID) continue;

      // ✅ CHECK LIST
      if (KNOWN_USERS[userKey]) {
        foundLabel = KNOWN_USERS[userKey];
      } 
      // ⚠️ FALLBACK
      else if (u.displayName) {
        foundLabel = u.displayName;
      }

      if (foundLabel) break; 
    }

    // Default if not found
    if (!foundLabel) foundLabel = "Direct Message";

    return json(200, { ok: true, names: { [space]: foundLabel } });

  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: String(err) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}