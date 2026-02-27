import { getAccessToken } from "./_google-creds.js";

// Helper to get name from email prefix if organization lookup fails
const nameFromEmail = (email) => {
  const prefix = email.split('@')[0];
  return prefix.split(/[._]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const KNOWN_USERS_MAP = {
  "jonathan@actuaryconsulting.co.za": "users/109833975621386956073",
  "simone@actuaryconsulting.co.za": "users/116928759608148752435",
  "tiffany@actuaryconsulting.co.za": "users/101273447946115685891",
  "albert@actuaryconsulting.co.za": "users/110481684541592719996",
  "tinashe@actuaryconsulting.co.za": "users/103060225088465733197",
  "ethan@actuaryconsulting.co.za": "users/105158373279991959375",
  "mine@actuaryconsulting.co.za": "users/112681921793658298066",
  "bianca@actuaryconsulting.co.za": "users/114609724339659491302",
  "alicia.o@actuaryconsulting.co.za": "users/100183703799963986718",
  "leonah@actuaryconsulting.co.za": "users/106094639157491328183",
  "eugene@actuaryconsulting.co.za": "users/100973980027446317396",
  "alicia.k@actuaryconsulting.co.za": "users/101954867987984084170",
  "songeziwe@actuaryconsulting.co.za": "users/108929714281084389788",
  "bonisa@actuaryconsulting.co.za": "users/110745530036003772233",
  "cameron@actuaryconsulting.co.za": "users/100710383419487896813",
  "shamiso@actuaryconsulting.co.za": "users/104310623309718505350",
  "waldo@actuaryconsulting.co.za": "users/113565695109176296608",
  "melvin@actuaryconsulting.co.za": "users/108628384720735354945",
  "yolandie@actuaryconsulting.co.za": "users/115863503558522206541",
  "enock@actuaryconsulting.co.za": "users/105726015150067918055",
  "matthew@actuaryconsulting.co.za": "users/114022848581179253421",
  "martin@actuaryconsulting.co.za": "users/104654529926543347255", 
  "melokuhle@actuaryconsulting.co.za": "users/111372729949487816593",
  "willem@actuaryconsulting.co.za": "users/113385769871096416574",
  "jennifer@actuaryconsulting.co.za": "users/103669371912398598964",
  "conah@actuaryconsulting.co.za": "users/117489264027903000976",
  "repository@actuaryconsulting.co.za": "users/112422887282158931745",
  "ryan@actuaryconsulting.co.za": "users/117124449099034019701",
  "siyolise@actuaryconsulting.co.za": "users/112417469383977278282",
};

export async function handler(event) {
  console.log("--- STARTING GCHAT-FIND-GM ---");

  try {
    let body = {};
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      body = { email: event.body };
    }

    const rawInput = body && body.email ? body.email : event.body;
    const emailInput = (rawInput || "").toLowerCase().trim();
    
    if (!emailInput || !emailInput.includes("@")) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please enter a full email address." }) };
    }

    const token = await getAccessToken(event);
    let resourceName = KNOWN_USERS_MAP[emailInput];
    let displayName = "";

    // 🧠 ATTEMPT 1: Get Full Name from organization directory (Most Accurate)
    const dirRes = await fetch(`https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(emailInput)}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (dirRes.ok) {
      const userData = await dirRes.json();
      resourceName = `users/${userData.id}`;
      displayName = userData.name?.fullName; // This is Name + Surname
      console.log("Directory Lookup Success:", displayName);
    } 
    
    // 🧠 ATTEMPT 2: Fallback to manual map if Directory fails but we have the ID
    if (!displayName && resourceName) {
      displayName = nameFromEmail(emailInput);
    }

    // 🧠 ATTEMPT 3: Exit if user still can't be identified
    if (!resourceName) {
      return { statusCode: 404, body: JSON.stringify({ error: "User not found in organization directory." }) };
    }

    const response = await fetch(`https://chat.googleapis.com/v1/spaces:setup`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        space: { 
          spaceType: "DIRECT_MESSAGE",
          singleUserBotDm: false 
        },
        memberships: [ { member: { name: resourceName, type: "HUMAN" } } ] 
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
        return { statusCode: response.status, body: JSON.stringify({ ok: false, error: result.error?.message || "Failed to create space." }) };
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ ok: true, space: result, displayName: displayName }) 
    };

  } catch (err) {
    console.error("CRITICAL FUNCTION ERROR:", err.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ ok: false, error: err.message }) 
    };
  }
}