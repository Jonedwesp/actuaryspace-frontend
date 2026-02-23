import { getAccessToken } from "./_google-creds.js";

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
  "martin@actuaryconsulting.co.za": "users/104654529926543347255"
};


export async function handler(event) {
  // 1. Log the start so the boss can see it in his terminal
  console.log("--- STARTING GCHAT-FIND-GM ---");

  try {
    // 2. Safety parse the body
    let body = {};
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      console.error("JSON Parse failed:", e);
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON format" }) };
    }

    const email = (body.email || "").toLowerCase().trim();
    console.log("Looking for user:", email);

    // 3. Check the map
    const resourceName = KNOWN_USERS_MAP[email];
    if (!resourceName) {
      return { statusCode: 404, body: JSON.stringify({ error: `User ${email} not found in map` }) };
    }

    // 4. Get Google Token
    const token = await getAccessToken();

    // 5. Setup the space using native fetch
    const response = await fetch(`https://chat.googleapis.com/v1/spaces:setup`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        space: { spaceType: "DIRECT_MESSAGE" },
        membership: [ { member: { name: resourceName } } ]
      })
    });

    const result = await response.json();
    return { 
      statusCode: response.ok ? 200 : response.status, 
      body: JSON.stringify({ ok: response.ok, data: result }) 
    };

  } catch (err) {
    // 6. Force the error to be a string so we don't get that "table of numbers"
    console.error("CRITICAL FUNCTION ERROR:", err.message);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ ok: false, error: err.message }) 
    };
  }
}
