import { google } from "googleapis";
import { loadServiceAccount } from "./_google-creds.js";

// (delete loadGoogleCreds entirely)

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const rawText = String(body.caseCardText || "").trim();

    if (!rawText) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: "Missing caseCardText in request body",
        }),
      };
    }

    // ---------- 1) Parse Case Card text ----------
    // Expect lines like:
    //   Claimant: Kamvelihle Dumezweni
    //   Matter: RAF LOE
    //   AC REF: MBALIKDUM
    function pick(label) {
      const re = new RegExp(`^${label}:\\s*(.+)$`, "mi");
      const m = rawText.match(re);
      return m ? m[1].trim() : "";
    }

    const claimant = pick("Claimant");
    const matter = pick("Matter");
    const acRef = pick("AC REF");

    const safeClaimant = claimant || "";
    const safeMatter = matter || "";
    const safeAcRef = acRef || "";

    // ---------- 2) Build SA dates for P & Q ----------
    const now = new Date();
    const plusOne = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    function formatSA(d) {
      // "2 Dec 2025" -> "2-Dec-2025"
      const s = d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Johannesburg",
      });
      return s.replace(/ /g, "-");
    }

    const dateP = formatSA(now);      // e.g. "2-Dec-2025"
    const dateQ = formatSA(plusOne);  // e.g. "3-Dec-2025"

    // ---------- 3) Build the row: A–Q ----------
    //
    // A-D: blank
    // E: "RAF Attorney"
    // F: Matter (RAF LOE)
    // G: Claimant
    // H: blank
    // I: AC REF
    // J-O: blank
    // P: date P
    // Q: date Q
    //
    const row = [
      "", // A
      "", // B
      "", // C
      "", // D
      "RAF Attorney",  // E
      safeMatter,      // F
      safeClaimant,    // G
      "",              // H
      safeAcRef,       // I
      "", "", "", "", "", "", // J–O
      dateP,           // P
      dateQ,           // Q
    ];

    // ---------- 4) Append to Google Sheet ----------
    const creds = loadServiceAccount();
    console.log("Using service account:", creds.client_email);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // IMPORTANT: use the tab name, NOT the file name
    const range = `'${SHEET_TAB_NAME}'!A:Q`;

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    console.log("Sheets append result:", res.data);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("sheet-update-tracker error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}