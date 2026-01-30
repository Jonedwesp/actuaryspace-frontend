// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import trelloIcon from "./assets/Trello Pic.png";
import gmailIcon from "./assets/Gmail pic.png";
import whatsappIcon from "./assets/WhatsApp.png";

const PERSONA = import.meta.env.VITE_PERSONA || "UNKNOWN";

const PERSONA_TRELLO_LISTS =
  PERSONA.toUpperCase() === "SIYA"
    ? ["Siya", "Siya - Review"]
    : PERSONA.toUpperCase() === "YOLANDIE"
    ? [
        "Yolandie to Data Capture",
        "Yolandie to Analyst",
        "Yolandie to Data Analyst",
        "Yolandie to Reviewer",
        "Yolandie to Send",
      ]
    : [];

/* ---------- Password Gate ---------- */
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "";
console.log("[PW GATE] enabled?", !!APP_PASSWORD, "len=", APP_PASSWORD.length);

function PasswordGate({ children }) {
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState("");

  // If no password set in Netlify env, don't gate (avoids locking yourself out by accident)
  const enabled = !!APP_PASSWORD;

  const unlocked =
    !enabled || localStorage.getItem("APP_UNLOCKED") === "1";

  const tryUnlock = () => {
    if (!enabled) return;
    if (pw === APP_PASSWORD) {
      localStorage.setItem("APP_UNLOCKED", "1");
      setErr("");
      window.location.reload(); // simplest: reload into unlocked state
    } else {
      setErr("Wrong password.");
    }
  };

  if (unlocked) return children;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0b0f17",
        color: "white",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <div
        style={{
          width: "min(420px, 92vw)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          ActuarySpace — Siya
        </div>
        <div style={{ opacity: 0.85, marginBottom: 14 }}>
          Enter password to continue.
        </div>

        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") tryUnlock();
          }}
          placeholder="Password"
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            outline: "none",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontSize: 14,
          }}
        />

        {err && (
          <div style={{ marginTop: 10, color: "#ff9aa2", fontSize: 13 }}>
            {err}
          </div>
        )}

        <button
          onClick={tryUnlock}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "none",
            background: "white",
            color: "#0b0f17",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Unlock
        </button>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Tip: If you change the password in Netlify later, clear site data / localStorage.
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function formatUKTime(date) {
  // Chats (WhatsApp/Slack): HH:MM
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function formatUKTimeWithSeconds(date) {
  // Notifications only: HH:MM:SS
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
const now = new Date();

/* ----- Trello date helpers ----- */
function pad2(n) { return String(n).padStart(2, "0"); }
function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; } // Sun/Sat

// Returns the next business day from `from`, at HH:MM
function nextBusinessDay({ from = new Date(), minDaysAhead = 1, time = "10:00" } = {}) {
  const d = new Date(from);
  d.setDate(d.getDate() + minDaysAhead);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  const [HH, MM] = time.split(":").map(Number);
  d.setHours(HH, MM, 0, 0);
  return d;
}

function nextTrialDate({ from = new Date(), daysAhead = 7 } = {}) {
  let d = new Date(from);
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" }); // e.g. Oct
  return `Trial date ${day} ${month}`;
}

function formatDueLine(d) {
  // e.g. "Due 27 Sept 10:00"
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" }); // Sept, Oct, …
  return `Due ${day} ${month} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Vite-only: this is compile-time transformed (works in prod)
const _AVATAR_MODULES = import.meta.glob(
  "./slack-profiles/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,gif,GIF}",
  { eager: true, import: "default" }
);

console.log("avatar modules", _AVATAR_MODULES);

const AVATARS = (() => {
  const map = {};
  for (const fullPath in _AVATAR_MODULES) {
    const fileBase = fullPath.split("/").pop().replace(/\.[^.]+$/, ""); // e.g. "Albert"
    const keyFull  = fileBase.toLowerCase().trim();                     // "albert"
    const tokens   = keyFull.split(/\s+/);
    const url      = _AVATAR_MODULES[fullPath];

    // full filename ("albert", "alicio o")
    if (!map[keyFull]) map[keyFull] = url;

    // first word
    if (tokens[0] && !map[tokens[0]]) map[tokens[0]] = url;

    // initials (e.g. "ao" from "Alicio O")
    if (tokens.length >= 2) {
      const initials = (tokens[0][0] + tokens[1][0]).toLowerCase();
      if (!map[initials]) map[initials] = url;
    }
  }

  console.log("AVATAR keys", Object.keys(map));  // 🔍 should now have lots of names
  return map;
})();


// Normalise aliases (two-letter codes etc.)
const AVATAR_ALIASES = {
  namir: "Namir", nw: "Namir",
  joel: "Joel", jj: "Joel",
  dionee: "Dionee", dd: "Dionee",
  "simoné": "Simoné", sm: "Simoné",
  ryan: "Ryan", ry: "Ryan",
  conah: "Conah", co: "Conah",
  thami: "Thami", th: "Thami",
  melissa: "Melissa", me: "Melissa",
  waldo: "Waldo", wa: "Waldo",
  melvin: "Melvin", mv: "Melvin",
  tiffany: "Tiffany", ti: "Tiffany",
  albert: "Albert", al: "Albert",
  "alicia k": "Alicia K", ak: "Alicia K",
  "alicia o": "Alicia O", ao: "Alicia O",
  ethan: "Ethan", et: "Ethan",
  martin: "Martin", ma: "Martin",
  leonah: "Leonah", le: "Leonah",
  matthew: "Matthew", mt: "Matthew",
  siyabonga: "Siyabonga", sd: "Siyabonga",
  enock: "Enock", en: "Enock",
  treasure: "Treasure", tr: "Treasure",
  melokuhle: "Melokuhle", mk: "Melokuhle",
  eugene: "Eugene", eu: "Eugene",
  bianca: "Bianca", bi: "Bianca",
  jonathan: "Jonathan", jw: "Jonathan",
  bonolo: "Bonolo", bo: "Bonolo",
  willem: "Willem", wi: "Willem",
  shamiso: "Shamiso", sh: "Shamiso",
  "miné": "Miné", mn: "Miné",
  songeziwe: "Songeziwe", so: "Songeziwe",
  michelle: "Michelle", mw: "Michelle",
  kwakhanya: "Kwakhanya", kw: "Kwakhanya",
  jennifer: "Jennifer", je: "Jennifer",
  munyaradzi: "Munyaradzi", mu: "Munyaradzi",
  leroy: "Leroy", lr: "Leroy",
  cameron: "Cameron", ca: "Cameron",
  jenny: "Jenny", jn: "Jenny",
  yolandie: "Yolandie", ys: "Yolandie",
  vanessa: "Vanessa", va: "Vanessa",
  yael: "Yael", ya: "Yael",
  cynthia: "Cynthia", cy: "Cynthia",
};

function remapBotName(name) {
  if (!name) return name;
  const trimmed = String(name).trim();
  // Any variant of "ActuarySpaceBot" becomes "Yolandie"
  if (/^actuaryspacebot$/i.test(trimmed)) return "Yolandie";
  return trimmed;
}

function avatarFor(name) {
  if (!name) return null;

  // strip things like " (web)", " (bot)", etc.
  let key = String(name).toLowerCase().trim();
  key = key.replace(/\([^)]*\)/g, "").trim(); // remove any (...) suffix
  key = key.replace(/\s+/g, " ");             // normalise spaces

  // Resolve aliases like "ys" -> "Yolandie", "ak" -> "Alicia K"
  const alias = AVATAR_ALIASES[key];
  if (alias) {
    const ak = alias.toLowerCase();
    const parts = ak.split(/\s+/);
    const inits = parts.map((p) => p[0]).join("");
    return (
      AVATARS[ak] ||
      AVATARS[parts[0]] ||
      AVATARS[inits] ||
      null
    );
  }

  // Direct hits: full name / first token / initials
  const parts = key.split(/\s+/);
  const inits = parts.map((p) => p[0]).join("");

  return (
    AVATARS[key] ||        // "yolandie"
    AVATARS[parts[0]] ||   // "yolandie" from "yolandie jv"
    AVATARS[inits] ||      // "yk" from "yolandie kotze"
    null
  );
}

/* Approved AC names */
const AC_CONTACTS = [
  "Namir","Joel","Dionee","Simoné","Ryan","Conah","Thami","Melissa","Waldo",
  "Melvin","Tiffany","Albert","Alicia K","Alicia O","Ethan","Martin","Leonah",
  "Matthew","Siyabonga","Enock","Treasure","Melokuhle","Eugene","Bianca",
  "Jonathan","Bonolo","Willem","Shamiso","Miné","Songeziwe","Michelle",
  "Kwakhanya","Jennifer","Munyaradzi","Leroy","Cameron","Jenny","Yolandie",
  "Vanessa","Yael","Cynthia"
];

/* ---------- WhatsApp ---------- */
const WA_AUTO_REPLIES = [
  "Got it — I’ll update Trello now.",
  "Thanks, I’ll review and circle back shortly.",
  "Perfect, I’ll push this to the reviewer.",
  "Cool, taking this forward.",
  "Noted. I’ll check the attachments too.",
  "Thanks, that helps. Will revert soon.",
];
function buildSeedChats() {
  const t = (minsAgo) => formatUKTime(new Date(Date.now() - minsAgo * 60 * 1000));
  return {
    Siyabonga: [
      { from: "them", text: "Morning Yolandie, did you see the new instruction from Cameron? It looks like LOS, death cert is attached.", time: t(210) },
      { from: "me",   text: "Morning Siya, yes I saw it. I’ll create the AC REF and forward to you and the team.", time: t(209) },
      { from: "them", text: "Thanks. Please add it to urgent reviews as well so we don’t miss it.", time: t(208) },
      { from: "me",   text: "Done. I also added a note on the trial date and linked the email thread.", time: t(206) },
      { from: "them", text: "Great. I’m drafting the checklist now. If we’re missing bank statements I’ll ping the client partner.", time: t(203) },
      { from: "me",   text: "Perfect. Shout if you need anything else from the inbox or Tracker.", time: t(201) },
      { from: "them", text: "Can you move GA Chabani to Analyst? I want to start with the data capture.", time: t(198) },
      { from: "me",   text: "Moved. Status set to Capturing Data and label RAF LOE kept.", time: t(197) },
      { from: "them", text: "Legend. I’ll update once the checklists are through.", time: t(196) },
    ],
    Waldo: [
      { from: "them", text: "I’ve added comments to the LOE draft. The earnings periods needed a small adjustment.", time: t(180) },
      { from: "me",   text: "Thanks, I’ll acknowledge and let the reviewer know. Did you attach the revised schedule?", time: t(179) },
      { from: "them", text: "Yes, attached. Also flagged one assumption in a yellow note so it’s easy to spot.", time: t(177) },
      { from: "me",   text: "Perfect. I’ll forward the pack to the reviewer bucket and tag you on Slack if anything is unclear.", time: t(175) },
      { from: "them", text: "Appreciated. If the client replies on the old thread, please loop me back in.", time: t(173) },
      { from: "me",   text: "Will do. I’ll keep the AC REF thread tidy and up to date.", time: t(172) },
    ],
    Michelle: [
      { from: "them", text: "Client just sent the payslips. Uploading now. There are two missing months but they promised to send today.", time: t(160) },
      { from: "me",   text: "Thank you. I’ll add what we have to the Trello card and note the missing months.", time: t(159) },
      { from: "them", text: "Please also add their instruction letter. I put it in the same folder.", time: t(157) },
      { from: "me",   text: "Added and linked. I’ll draft the acknowledgement mail and include our AC REF.", time: t(155) },
      { from: "them", text: "Perfect, that keeps them calm. Let me know when you send it so I can track response times.", time: t(154) },
      { from: "me",   text: "Acknowledgement sent. Tracker updated with today’s date.", time: t(152) },
    ],
    Leonah: [
      { from: "them", text: "Moving this to Ready to Send. I checked references and the annexures render correctly.", time: t(120) },
      { from: "me",   text: "Nice. I’ll do a last scan for formatting and then send from the generic mailbox.", time: t(119) },
      { from: "them", text: "Please CC me and the client partner. Subject line has the AC REF already.", time: t(118) },
      { from: "me",   text: "Done — queued. I’ll paste the delivery confirmation back into the card.", time: t(116) },
    ],
    Matthew: [
      { from: "them", text: "Can we add this to urgent reviews? Counsel is pushing for a quick turnaround.", time: t(95) },
      { from: "me",   text: "Added. Is there any missing info from the last round?", time: t(94) },
      { from: "them", text: "We still need the affidavit and one proof of income. Client promised by lunch.", time: t(93) },
      { from: "me",   text: "Got it. I’ll hold the reviewer until those land, then release.", time: t(92) },
      { from: "them", text: "Thanks. If it slips, please post a short note in #urgent-reviews.", time: t(91) },
      { from: "me",   text: "Will do. I’ll keep the label on HIGH URGENT for visibility.", time: t(90) },
    ],
  };
}

/* ---------- Email draft templates (Yolandie picks one, then edits) ---------- */
const DRAFT_TEMPLATES = [
  {
    id: "new_blank",
    label: "New Draft",
    body: "",            // completely empty
  },
  {
    id: "new_instr_ack",
    label: "New instructions – acknowledge & confirm trial / lodgement",
    body: [
      "Dear [Attorney Name],",
      "",
      "Thank you for your email and the new instructions in the above matter.",
      "",
      "We acknowledge receipt of the instruction letter and supporting documentation. ",
      "Kindly confirm the following so that we can proceed efficiently:",
      "1. Has this matter been lodged with the Road Accident Fund?",
      "2. Is there a trial date or any court deadline for this matter?",
      "",
      "Once we receive your confirmation (and any outstanding documents), we will proceed with our calculations and revert with an estimated turnaround time.",
      "",
      "Kind regards,",
      "Namir Waisberg",
      "Actuary Consulting",
    ].join("\n"),
  },
  {
    id: "awaiting_medicals",
    label: "Acknowledgement – awaiting medico-legal reports",
    body: [
      "Dear [Attorney Name],",
      "",
      "Thank you for your email and the documentation provided in respect of the above matter.",
      "",
      "We confirm safe receipt of the available documents. We note that certain medico-legal reports are still outstanding, and will commence our calculations once these have been received.",
      "",
      "Please feel free to let us know if there are any particular time constraints or court dates that we should be aware of.",
      "",
      "Kind regards,",
      "Namir Waisberg",
      "Actuary Consulting",
    ].join("\n"),
  },
  {
    id: "missing_income_docs",
    label: "Request – missing income / bank documents",
    body: [
      "Dear [Attorney Name],",
      "",
      "Thank you for your instructions in the above matter.",
      "",
      "We have reviewed the documents received and note that certain income-related records (e.g. payslips, bank statements and/or tax returns) are still outstanding.",
      "",
      "Kindly provide the missing income documents at your earliest convenience so that we can finalise the loss of earnings calculations.",
      "",
      "If there is any difficulty in obtaining these records, please let us know and we will advise on possible alternatives.",
      "",
      "Kind regards,",
      "Namir Waisberg",
      "Actuary Consulting",
    ].join("\n"),
  },
  {
    id: "progress_update",
    label: "Progress update – reassurance on timeline",
    body: [
      "Dear [Attorney Name],",
      "",
      "We refer to the above matter and confirm that we are in the process of finalising our actuarial calculations.",
      "",
      "All available documents have been captured and we are now working through the detailed projections. ",
      "Barring any unforeseen issues or further information requests, we anticipate reverting with a draft report by [date].",
      "",
      "Should any new information become available in the interim, please forward it to us so we can incorporate it before finalising.",
      "",
      "Kind regards,",
      "Namir Waisberg",
      "Actuary Consulting",
    ].join("\n"),
  },
  {
    id: "send_draft_report",
    label: "Cover email when sending draft report",
    body: [
      "Dear [Attorney Name],",
      "",
      "We attach herewith our draft actuarial report in respect of the above matter for your review.",
      "",
      "Kindly consider the contents and let us know if there are any factual corrections, additional information or points of clarification before we finalise the report.",
      "",
      "Once you are satisfied that the draft accords with your instructions and the available documentation, we will prepare and issue the signed final report.",
      "",
      "Kind regards,",
      "Namir Waisberg",
      "Actuary Consulting",
    ].join("\n"),
  },
];

/* ---------- Email (Gmail view with split PDF preview) ---------- */
const EMAIL_THREADS = [
  {
    id: "eml-001",
    subject: "FW: LR MDLET SHE vs RAF (OUR REF: 15/M412-0001)",
    fromName: "Namir Waisberg",
    fromEmail: "namir@actuaryconsulting.co.za",
    to: ["Yolandie <yolandie@actuaryspace.co.za>"],
    time: formatUKTime(new Date()),
    body:
`---------- Forwarded message ----------
From: Roshan Morar <litigation@dhllaw.co.za>
Date: Mon, Jul 28, 2025 at 9:03 AM
Subject: LR MDLETSHE vs RAF (OUR REF: 15/M412-0001)
To: Namir Waisberg <namir@actuaryconsulting.co.za>
Cc: Tinashe Jaya <tinashe@dhllaw.co.za>

PART 2

I refer to the above matter.

Attached herewith please find our instruction letter, together with attachments in 3 parts, for your attention.

Kind Regards

Roshan Morar
Du Toit Havemann & Lloyd
Tel: (031) 201 3555 • Fax: (031) 201 3650
Email: litigation@dhllaw.co.za
Website: www.dhllaw.co.za`,
    attachments: [
      { name: "New Instruction.pdf", url: "/pdfs/New-Instruction.pdf", type: "pdf" },
    ],
    actions: [
      { key: "submit_trello",  label: "Submit to Trello" },
      { key: "update_tracker", label: "Update AC Tracker" },
    ],
  },
  {
    id: "eml-002",
    subject: "FW: LR MDLETSHE vs RAF (OUR REF: 15/M412-0001) – PART 3",
    fromName: "Namir Waisberg",
    fromEmail: "namir@actuaryconsulting.co.za",
    to: ["Yolandie <yolandie@actuaryspace.co.za>"],
    time: formatUKTime(new Date()),
    body:
`---------- Forwarded message ----------
From: Roshan Morar <litigation@dhllaw.co.za>
Date: Mon, Jul 28, 2025 at 9:06 AM
Subject: LR MDLETSHE vs RAF (OUR REF: 15/M412-0001)
To: Namir Waisberg <namir@actuaryconsulting.co.za>
Cc: Tinashe Jaya <tinashe@dhllaw.co.za>

PART 3

I refer to the above matter.

Attached herewith please find our instruction letter, together with attachments in 3 parts, for your attention.

Kind Regards
Roshan Morar`,
    attachments: [
      { name: "Payslips.pdf",        url: "/pdfs/Payslips.pdf",        type: "pdf" },
      { name: "Bank Statement.pdf",  url: "/pdfs/Bank-Statement.pdf",  type: "pdf" },
      { name: "ID/Birth/Death Certificate.pdf", url: "/pdfs/ID-Birth-Death-Certificate.pdf", type: "pdf" },
      { name: "New Instruction.pdf", url: "/pdfs/New-Instruction.pdf", type: "pdf" },
      { name: "Payslips (extra).pdf",url: "/pdfs/Payslips.pdf",        type: "pdf" },
    ],
    actions: [
      { key: "submit_trello",  label: "Submit to Trello" },
      { key: "update_tracker", label: "Update AC Tracker" },
    ],
  },
  {
    id: "eml-003",
    subject: "FW: MOHLAKOANE DONALD PULENG // RAF // ASSESSMENT",
    fromName: "Namir Waisberg",
    fromEmail: "namir@actuaryconsulting.co.za",
    to: ["Yolandie <yolandie@actuaryspace.co.za>"],
    time: formatUKTime(new Date()),
    body:
`---------- Forwarded message ----------
From: Ndisalelwani Mphadziseni <maleka2@knmattorneys.co.za>
Date: Mon, Jul 28, 2025 at 10:18 AM
Subject: MOHLAKOANE DONALD PULENG // ROAD ACCIDENT FUND // ASSESSMENT
To: Namir Waisberg <namir@actuaryconsulting.co.za>
Cc: multiple recipients

Good day

I hope this email finds you well.

Kindly find the attached documents for your valued attention.
Kindly also note that the Orthopaedic, Occupational Therapist reports and any additional information will be sent through as soon as we receive them.

Claimant contact details: 079 810 8834

Regards
N.P. Mphadziseni`,
    attachments: [
      { name: "Bank Statement.pdf",             url: "/pdfs/Bank-Statement.pdf",             type: "pdf" },
      { name: "ID/Birth/Death Certificate.pdf", url: "/pdfs/ID-Birth-Death-Certificate.pdf", type: "pdf" },
      { name: "Payslips.pdf",                   url: "/pdfs/Payslips.pdf",                   type: "pdf" },
      { name: "New Instruction.pdf",            url: "/pdfs/New-Instruction.pdf",            type: "pdf" },
      { name: "Payslips (extra).pdf",           url: "/pdfs/Payslips.pdf",                   type: "pdf" },
      { name: "Bank Statement (extra).pdf",     url: "/pdfs/Bank-Statement.pdf",             type: "pdf" },
    ],
    actions: [
      { key: "submit_trello",  label: "Submit to Trello" },
      { key: "update_tracker", label: "Update AC Tracker" },
    ],
  },
];

const DEMO_CASE_CARD_TEXT = `
Case Card Summary
───────────────────────
Claimant: Siyanda Sidwell Kali
Matter: RAF LOE
AC REF: MANANSSKAL
Description: Fwd: NEW INSTRUCTIONS - SS KALI (AC REF: MANANSSKAL)
`.trim();

/* ---------- Trello card modal (helpers) ---------- */
function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildTrelloCardFromNotif(notifText = "") {
  // Try get a card title from the quoted bit in the notification
  const titleFromNotif =
    (notifText.match(/"([^"]+)"/)?.[1]) ||
    "C Makhubele (TC 25 September 14:00)";

  const actor = "yolandie123.yjvv";
  const possibleTargets = AC_CONTACTS.filter(n => !/yolandie/i.test(n));
  const target = randomPick(possibleTargets);

  return {
    id: "trello-card-1",
    boardList: "Yolandie to Send",
    title: titleFromNotif,
    dueDisplay: "Due 25 Sept 09:12",
    members: ["Waldo", "Michelle", "Enock", "Siyabonga", "Yolandie"],
    labels: ["RAF LOE"],
    description: deriveDescriptionFromTitle(titleFromNotif),
    timers: { time: "10h 19m" },
    activity: [
      { who: actor, text: `added this card to ${target}`, time: formatUKTime(new Date()) },
      {
        who: "Matthew Darch",
        text: [
          "*Excel:*",
          "1. HRT: Cell M39 has the incorrect start date (should be 2032).",
          '2. HRT: Cell AD18 should reference “=L38+$M$39*5”.',
          "3. Set career ceiling at age 45 (year 2055).",
          "4. Calc date needs updating.",
          "",
          "*Report:*",
          "• Update report date, calc date, future loss period and summary tables after Excel changes."
        ].join("\n"),
        time: formatUKTime(new Date())
      }
    ]
  };
}

function parseCustomFieldsFromBadges(badges = []) {
  const out = {};
  badges.forEach(b => {
    const t = b.text || "";
    if (/^Priority/i.test(t)) out.priority = canonicalPriority(t.replace(/^Priority:\s*/i, ""));
    if (/^Status/i.test(t))   out.status   = t.replace(/^Status:\s*/i, "");
    if (/^Active/i.test(t))   out.active   = t.replace(/^Active:\s*/i, "");
  });
  return out;
}

function deriveDescriptionFromTitle(title = "") {
  // strip LM/MD time tags and the Due tag, keep other text
  let s = String(title);
  s = s.replace(/\(\s*(LM|MD)\s+\d{1,2}\s+\w+\s+\d{2}:\d{2}\s*\)/gi, "");
  s = s.replace(/\(\s*Due[^)]*\)/gi, "");
  s = s.replace(/\s{2,}/g, " ").replace(/\s*-\s*$/,"").trim();
  // Style: "Re: <remaining>"
  return s ? `Re: ${s}` : "";
}

// --- Trello custom field setter ---
async function setCardCustomField(cardId, fieldName, valueText) {
  const res = await fetch("/.netlify/functions/trello-set-custom-field", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId, fieldName, valueText }),
  });
  const json = await res.json().catch(async () => ({ raw: await res.text().catch(() => "") }));
  if (!res.ok || json?.ok !== true) {
    const msg = JSON.stringify(json);
    throw new Error(`Trello write failed (${res.status}): ${msg}`);
  }
  return json;
}

// NEW: Description setter (writes Trello card.desc)
async function setCardDescription(cardId, desc) {
  const res = await fetch("/.netlify/functions/trello-set-description", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId, desc }),
  });
  const json = await res.json().catch(async () => ({ raw: await res.text().catch(() => "") }));
  if (!res.ok || json?.ok !== true) {
    const msg = JSON.stringify(json);
    throw new Error(`Trello description write failed (${res.status}): ${msg}`);
  }
  return json;
}

const LABEL_OPTIONS = [
  "Breach of Contract","Paid Payment arrangement","Personal injury",
  "Non-RAF LOE","Pension Calculations","Labour","RAF LOE"
];
const PRIORITY_OPTIONS = ["HIGH URGENT","URGENT + IMPORTANT","URGENT","NEW CLIENT"];
// Put "Working on it" first (as requested)
const ACTIVE_OPTIONS = ["Working on it","Not working on it"];

// NEW: map Active value -> badge/select color class
function activeTypeFromText(txt) {
  const v = String(txt || "").trim().toLowerCase();
  if (v === "working on it") return "active-green";
  if (v === "not working on it") return "active-orange";
  return "active-default";
}
const STATUS_OPTIONS = [
  "To Do - RAF","To Do - Other","Doing Data Review","Asking IP",
  "Ready to be reviewed - 24hr","Ready to be reviewed - URGENT",
  "Ready to be reviewed - New Client","Urgent Ready to be reviewed - Long Cases",
  "2nd Review","Analyst to Update","Reviewer Respond","Ready to send",
  "Waiting for client info","Approved","Pause","Actuary Expert","Asking Senior Analyst",
  "Capturing Data","Data Review","Checklist Doing"
];

function canonicalPriority(txt) {
  const p = String(txt || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (p === "HIGH URGENT" || p === "HIGH-URGENT") return "HIGH URGENT";
  if (p === "URGENT + IMPORTANT" || p === "URGENT+IMPORTANT") return "URGENT + IMPORTANT";
  if (p === "URGENT") return "URGENT";
  if (p === "NEW CLIENT" || p === "NEW-CLIENT") return "NEW CLIENT";
  return ""; // unknown/blank
}
function priorityTypeFromText(txt) {
  const p = canonicalPriority(txt);
  return p === "HIGH URGENT"        ? "priority-green"  :
         p === "URGENT + IMPORTANT" ? "priority-red"    :
         (p === "URGENT" || p === "NEW CLIENT") ? "priority-purple" :
         "priority-default";
}

function statusTypeFromText(txt) {
  const v = String(txt || "").trim().toLowerCase();
  if (v.startsWith("to do - raf")) return "status-yellow";
  if (v.startsWith("to do - other")) return "status-blue";
  if (v === "doing") return "status-green";
  if (v === "data review") return "status-lime";
  if (v === "asking ip") return "status-purple";
  if (v.includes("ready to be reviewed - 24hr")) return "status-pink";
  if (v.includes("ready to be reviewed - urgent")) return "status-blue";
  if (v.includes("ready to be reviewed - new client urgent")) return "status-yellow";
  if (v.includes("urgent ready to be reviewed - longer cases")) return "status-darkyellow";
  if (v === "2nd review" || v === "checklist doing") return "status-white";
  if (v === "analyst to update") return "status-blue";
  if (v === "reviewer respond") return "status-red";
  if (v === "ready to send") return "status-green";
  if (v === "waiting for client info") return "status-purple";
  if (v === "approved") return "status-purple";
  if (v === "pause") return "status-yellow";
  if (v === "actuary expert") return "status-blue";
  if (v === "asking senior analyst") return "status-yellow";
  if (v === "capturing data") return "status-green";
  return "status-default";
}

function ensureBadgeTypes(badges = []) {
  return (badges || []).map(b => {
    const t = b?.text || "";
    if (/^Active\s*:/i.test(t)) {
      const val = t.replace(/^Active\s*:\s*/i, "");
      return { ...b, type: b.type || activeTypeFromText(val) };
    }
    if (/^Priority\s*:/i.test(t)) {
      const val = t.replace(/^Priority\s*:\s*/i, "");
      return { ...b, type: b.type || priorityTypeFromText(val) };
    }
    if (/^Status\s*:/i.test(t)) {
      const val = t.replace(/^Status\s*:\s*/i, "");
      return { ...b, type: b.type || statusTypeFromText(val) };
    }
    return b;
  });
}

function RightPanel() {
  const [preview, setPreview] = React.useState(null);

  // Live Trello buckets (unchanged)
  const [trelloBuckets, setTrelloBuckets] = useState([]);

  // NEW: files that App pushes in via setClientFiles event
  const [clientFiles, setClientFiles] = useState([]);

  // helper: update a single card in the visible columns immediately (no waiting for poll)
  const patchCardInBuckets = (cardId, updater) => {
    setTrelloBuckets((prev) => {
      const copy = prev.map((b) => ({ ...b, cards: [...b.cards] }));
      for (const b of copy) {
        const idx = b.cards.findIndex((c) => c.id === cardId);
        if (idx !== -1) {
          const old = b.cards[idx];
          b.cards[idx] =
            typeof updater === "function" ? updater(old) : { ...old, ...updater };
          break;
        }
      }
      return copy;
    });
  };

  const prevCardListRef = useRef(new Map()); // cardId -> listTitle
  const hasSnapshotRef = useRef(false);
  const YOLANDIE_BUCKETS = new Set([
    "Yolandie to Analyst",
    "Yolandie to Data Analyst",
    "Yolandie to Reviewer",
    "Yolandie to Send",
  ]);

  const recentNotifsRef = useRef(new Map());
  const NOTIF_DEDUP_MS = 4000;

  const pendingCFRightRef = useRef(new Map());

  // 🔊 Listen for "setClientFiles" events from App (email open / clear)
  useEffect(() => {
    function onSetClientFiles(e) {
      const files = (e.detail && e.detail.files) || [];
      setClientFiles(Array.isArray(files) ? files : []);
      setPreview(null); // reset any preview
    }

    window.addEventListener("setClientFiles", onSetClientFiles);
    return () => window.removeEventListener("setClientFiles", onSetClientFiles);
  }, []);

  // 🔊 Listen for preview requests from App (when right-panel tile is clicked)
  useEffect(() => {
    function onOpenEmailAttachmentPreview(e) {
      const file = e.detail?.file;
      if (!file) return;
      setPreview(file);
    }

    window.addEventListener(
      "openEmailAttachmentPreview",
      onOpenEmailAttachmentPreview
    );

    return () => {
      window.removeEventListener(
        "openEmailAttachmentPreview",
        onOpenEmailAttachmentPreview
      );
    };
  }, []);

  // --- Trello polling (unchanged from your working version) ---
  useEffect(() => {
    async function fetchTrello() {
      try {
        console.log("[UI] VITE_PERSONA =", import.meta.env.VITE_PERSONA);

        const res = await fetch(`/.netlify/functions/trello`);

        // 🔎 Log status + raw text if not OK
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error("[TRELLO] HTTP error", res.status, txt);
          return;
        }

        const json = await res.json();
        console.log("[TRELLO] raw JSON from function:", json);

        // Handle multiple possible shapes:
        // { buckets: [...] }  OR  [...]  OR  { lists: [...] }
        const rawBuckets = Array.isArray(json?.buckets)
          ? json.buckets
          : Array.isArray(json)
          ? json
          : Array.isArray(json?.lists)
          ? json.lists
          : [];

        console.log("[TRELLO] rawBuckets after shape-detect:", rawBuckets);

        if (!rawBuckets.length) {
          // nothing came back – surface this in UI as a fake column so you see *something*
          setTrelloBuckets([
            {
              id: "demo-empty",
              title: "No Trello data",
              cards: [
                {
                  id: "demo-card",
                  title: "Trello function returned no lists/cards",
                  due: "",
                  badges: [],
                  eta: "",
                  people: [],
                  listId: "demo-empty",
                  list: "No Trello data",
                  labels: [],
                  customFields: {},
                  description:
                    "Check /.netlify/functions/trello logs or response shape.",
                },
              ],
            },
          ]);
          return;
        }

        // Map whatever comes back – be defensive on title/name fields
        let mapped = rawBuckets.map((b) => {
          const title = b.title || b.name || b.list || "";
          return {
            id: b.id,
            title,
            cards: (b.cards || []).map((c) => ({
              id: c.id,
              title: c.title,
              due: c.due || "",
              badges: ensureBadgeTypes(Array.isArray(c.badges) ? c.badges : []),
              eta: "",
              people: c.people || [],
              listId: c.listId || b.id,
              list: c.list || title,
              labels: c.labels || [],
              customFields: c.customFields || {},
              description: c.description || "",
            })),
          };
        });

        const persona = (import.meta.env.VITE_PERSONA || "").toLowerCase().trim();

        const PERSONA_TITLES =
          persona === "siya"
            ? ["Siya", "Siya - Review"]
            : [
                "Yolandie to Data Capture",
                "Yolandie to Analyst",
                "Yolandie to Data Analyst",
                "Yolandie to Reviewer",
                "Yolandie to Send",
              ];

        const filtered = mapped.filter((b) => PERSONA_TITLES.includes(b.title));
        if (filtered.length > 0) mapped = filtered;

        let latestMerged = null;

        setTrelloBuckets((prev) => {
          const now = Date.now();
          const prevById = new Map();
          for (const b of prev) {
            for (const c of b.cards || []) prevById.set(c.id, c);
          }

          const merged = mapped.map((b) => ({
            ...b,
            cards: (b.cards || []).map((c) => {
              const prevCard = prevById.get(c.id);
              if (!prevCard) return c;

              const pend = pendingCFRightRef.current.get(c.id) || {};
              const keepBadgeIfPending = (label) => {
                const isPending = pend[label] && pend[label] > now;
                if (!isPending) return c.badges;

                const prevBadge = (prevCard.badges || []).find((x) =>
                  new RegExp(`^${label}\\s*:\\s*`, "i").test(x?.text || "")
                );
                if (!prevBadge) return c.badges;

                const others = (c.badges || []).filter(
                  (x) =>
                    !new RegExp(`^${label}\\s*:\\s*`, "i").test(x?.text || "")
                );
                return [prevBadge, ...others];
              };

              let badges = c.badges || [];
              badges = keepBadgeIfPending("Priority");
              badges = keepBadgeIfPending("Active");
              badges = keepBadgeIfPending("Status");
              badges = ensureBadgeTypes(badges);
              return { ...c, badges };
            }),
          }));

          latestMerged = merged;
          return merged;
        });

        window.dispatchEvent(
          new CustomEvent("bucketsUpdated", {
            detail: { buckets: latestMerged || mapped },
          })
        );

        // snapshot logic unchanged…
        const currCardList = new Map();
        for (const b of mapped) {
          for (const c of b.cards) {
            const stableId =
              c.id ||
              c.shortLink ||
              c.idShort ||
              (typeof c.url === "string"
                ? c.url.split("/").pop()
                : null) ||
              `${b.id}:${c.title}`;
            if (!stableId) continue;
            currCardList.set(stableId, b.title);
          }
        }

        if (hasSnapshotRef.current) {
          const nowTs = Date.now();
          for (const [cardId, newList] of currCardList) {
            const oldList = prevCardListRef.current.get(cardId);
            if (YOLANDIE_BUCKETS.has(newList) && oldList !== newList) {
              const targetBucket = mapped.find((b) => b.title === newList);
              const card = targetBucket?.cards.find((c) => {
                const stableId =
                  c.id ||
                  c.shortLink ||
                  c.idShort ||
                  (typeof c.url === "string"
                    ? c.url.split("/").pop()
                    : null) ||
                  `${targetBucket.id}:${c.title}`;
                return stableId === cardId;
              });
              const title = card?.title || "Card";

              const key = `${cardId}|${oldList || "unknown"}->${newList}`;
              const lastTs = recentNotifsRef.current.get(key);
              if (!lastTs || nowTs - lastTs > NOTIF_DEDUP_MS) {
                window.dispatchEvent(
                  new CustomEvent("notify", {
                    detail: {
                      text: `Card "${title}" arrived in ${newList}${
                        oldList ? ` from ${oldList}` : ""
                      }`,
                      cardId,
                    },
                  })
                );
                recentNotifsRef.current.set(key, nowTs);
              }
              for (const [k, ts] of recentNotifsRef.current) {
                if (nowTs - ts > NOTIF_DEDUP_MS * 3)
                  recentNotifsRef.current.delete(k);
              }
            }
          }
        }

        prevCardListRef.current = currCardList;
        hasSnapshotRef.current = true;
      } catch (err) {
        console.error("Error loading Trello via function:", err);
      }
    }

    fetchTrello();
    const id = setInterval(fetchTrello, 3000);
    return () => clearInterval(id);
  }, []);

  // Allow App() to patch visible cards instantly
  useEffect(() => {
    function onPatchBuckets(e) {
      const { cardId, updater } = e.detail || {};
      if (!cardId || !updater) return;
      patchCardInBuckets(cardId, updater);
    }
    window.addEventListener("patchCardInBuckets", onPatchBuckets);
    return () => window.removeEventListener("patchCardInBuckets", onPatchBuckets);
  }, []);

  // Map clientFiles -> UI files
  const files = (clientFiles || []).map((f, i) => {
    let type = f.type || "other";
    if (!f.type && f.mimeType) {
      if (f.mimeType === "application/pdf") type = "pdf";
      else if (f.mimeType.startsWith("image/")) type = "img";
      else if (
        f.mimeType ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        f.mimeType === "application/vnd.ms-excel"
      )
        type = "xls";
    }

    const url =
      f.url ||
      (f.id
        ? `/.netlify/functions/drive-download?id=${encodeURIComponent(f.id)}`
        : "#");

    const thumbUrl = f.thumbUrl || url;

    return {
      id: f.id || `att-${i}`,
      name: f.name || `Attachment ${i + 1}`,
      type,
      url,
      thumbUrl,
    };
  });

  const isImage = (t) => t === "img";
  const isPdf = (t) => t === "pdf";
  const isExcel = (t) => t === "xls";

  return (
    <div className="right-panel">
      <div className="panel-title">Trello Cards</div>
      <div className="right-scroll left-scroll">
        <div className="trello-col-wrap">
          {trelloBuckets.map((bucket, i) => (
            <div className="tl-col" key={i}>
              <div className="tl-head">
                <span className="tl-title">{bucket.title}</span>
                <span className="tl-actions">⋮</span>
              </div>
              <div className="tl-cards">
                {bucket.cards.map((card, j) => (
                  <div
                    className="tl-card"
                    key={card.id || j}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("openTrelloCard", { detail: card })
                      )
                    }
                  >
                    <div className="tl-card-topbar" />
                    <div className="pill" />
                    <div className="tl-card-title">
                      <strong>{card.title}</strong>{" "}
                      <span className="tl-muted">({card.due})</span>
                      {card.trial && (
                        <div
                          className="tl-muted"
                          style={{ fontSize: ".85rem" }}
                        >
                          {card.trial}
                        </div>
                      )}
                    </div>

                    <div className="tl-badges">
                      {[...(card.badges || [])]
                        .sort((a, b) => {
                          const order = (txt) => {
                            if (/^Priority\s*:/i.test(txt)) return 0;
                            if (/^Status\s*:/i.test(txt)) return 1;
                            if (/^Active\s*:/i.test(txt)) return 2;
                            return 3;
                          };
                          return (
                            order(a?.text || "") - order(b?.text || "")
                          );
                        })
                        .map((b, k) => (
                          <span
                            key={k}
                            className={`tl-badge ${b.type || ""}`}
                          >
                            {b.text}
                          </span>
                        ))}
                    </div>

                    <div className="tl-footer">
                      {card.eta && (
                        <span className="tl-eta">{card.eta}</span>
                      )}
                      {card.people?.length > 0 && (
                        <div className="tl-people">
                          {card.people.map((p, idx) => {
                            const img = avatarFor(p);
                            return img ? (
                              <img
                                key={idx}
                                className="av-img"
                                src={img}
                                alt={p}
                                title={p}
                              />
                            ) : (
                              <div className="av" key={idx}>
                                {p}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button className="tl-add">+ Add a card</button>
            </div>
          ))}
        </div>

        <div className="panel-title" style={{ marginTop: "0.75rem" }}>
          Client Files
        </div>
                      <div className="doc-grid">
          {files.map((f) => (
            <button
              key={f.id}
              className={`doc-card ${f.type}`}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("openEmailAttachmentPreview", {
                    detail: { file: f },
                  })
                );
              }}
              title={f.name}
            >

              <div className="doc-preview">
                {isImage(f.type) ? (
                  // Real image
                  <img src={f.thumbUrl || f.url} alt={f.name} />
                ) : isPdf(f.type) ? (
                  // PDFs use iframe preview (never <img>)
                  <iframe
                    title={f.name}
                    src={f.url}
                    className="pdf-frame"
                  />
                ) : isExcel(f.type) ? (
                  <div className="doc-icon">XLS</div>
                ) : (
                  <div className="doc-icon">FILE</div>
                )}
              </div>

              <div className="doc-info">
                <span className={`doc-badge ${f.type}`}>
                  {f.type === "xls" ? "XLSX" : f.type.toUpperCase()}
                </span>
                <span className="doc-name">{f.name}</span>
              </div>

              <span className="doc-corner" />
            </button>
          ))}
        </div>
      </div>

      {/* we no longer show a separate modal here; preview is in the email split view */}
    </div>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [inputValue, setInputValue] = useState("");
  const [notifications, setNotifications] = useState([]);
  const nextIdRef = useRef(0);
  const rotateIdxRef = useRef(0);
  const emailRotateRef = useRef(0);

  const [currentView, setCurrentView] = useState({ app: "none", contact: null });

  const seenDriveEmailIdsRef = useRef(new Set());

  /* WhatsApp */
  const [waChats, setWaChats] = useState(() => buildSeedChats());
  const waBodyRef = useRef(null);

  /* Email */
  const [emailIdx, setEmailIdx] = useState(0);
  const [email, setEmail] = useState(EMAIL_THREADS[0]);
  const [emailPreview, setEmailPreview] = useState(null);

  // NEW: email draft helper state
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [selectedDraftTemplate, setSelectedDraftTemplate] = useState(null);
  const [draftTo, setDraftTo] = useState("");   // 👈 NEW

  /* Trello modal */
  const [trelloCard, setTrelloCard] = useState(null);
  const [trelloMenuOpen, setTrelloMenuOpen] = useState(false);

  // NEW: local Description editor state
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  const pendingCFRef = useRef(new Map()); // cardId -> { fieldName: expiryTs }

  useEffect(() => {
    const onNotify = (e) => {
      const { text, cardId } = e.detail || {};
      if (!text) return;
      const unique = `${cardId || "noid"}-${nextIdRef.current++}`;
      const item = {
        id: `tl-${unique}`,
        alt: "Trello",
        icon: trelloIcon,
        text,
        time: formatUKTimeWithSeconds(new Date()),
        cardId,
      };
      setNotifications((prev) => [item, ...prev].slice(0, 200));
    };
    window.addEventListener("notify", onNotify);
    return () => window.removeEventListener("notify", onNotify);
  }, []);

      // 🔔 Poll Data Centre (Google Drive) for new instruction emails
  useEffect(() => {
    const seen = seenDriveEmailIdsRef.current;

    async function pollDriveEmails() {
      try {
        const res = await fetch("/.netlify/functions/drive-get-emails");
        const json = await res.json();
        if (!json || json.ok === false) {
          console.error("drive-get-emails error:", json);
          return;
        }

        const files = json.files || [];
        files.forEach((f) => {
          if (!f.id || !f.name) return;

          // Only notify once
          if (seen.has(f.id)) return;
          seen.add(f.id);

          const now = new Date();
          const subject =
            (f.subject && f.subject.trim()) ||
            f.name.replace(/\.eml$/i, "") ||
            "Client Instruction (Data Centre)";

          const driveEmail = {
            id: f.id,
            name: f.name,
            subject,
          };

          setNotifications((prev) => [
            {
              id: `eml-${f.id}`,
              alt: "Gmail",
              icon: gmailIcon,
              text: `Gmail: ${subject}`,
              time: formatUKTimeWithSeconds(now),
              driveEmail,
            },
            ...prev,
          ]);
        });
      } catch (err) {
        console.error("pollDriveEmails failed:", err);
      }
    }

    // Run immediately
    pollDriveEmails();

    // Then every 20s
    const timer = setInterval(pollDriveEmails, 20000);
    return () => clearInterval(timer);
  }, [setNotifications]);

    // When we are not looking at an email, the right-panel client files should be empty
  useEffect(() => {
    if (currentView.app !== "email") {
      window.dispatchEvent(
        new CustomEvent("setClientFiles", { detail: { files: [] } })
      );
    }
  }, [currentView.app]);

    // When right-panel client files are clicked, open PDF in middle-pane split view
  useEffect(() => {
    function onOpenEmailAttachmentPreview(e) {
      const file = e.detail?.file;
      if (!file) return;

      // Switch to Gmail view
      setCurrentView({ app: "email", contact: null });

      // Open the preview in the split view
      setEmailPreview(file);
    }

    window.addEventListener(
      "openEmailAttachmentPreview",
      onOpenEmailAttachmentPreview
    );

    return () => {
      window.removeEventListener(
        "openEmailAttachmentPreview",
        onOpenEmailAttachmentPreview
      );
    };
  }, []);

  useEffect(() => {
  const handler = (e) => {
    setTrelloMenuOpen(false);
    // 👇 NEW: reset editor state on open
    setDescEditing(false);
    setDescDraft("");

    setCurrentView({ app: "trello", contact: null });
    setTrelloCard({
      id: e.detail.id,
      boardList: e.detail.list || "Yolandie",
      listId: e.detail.listId || null,
      title: e.detail.title,
      dueDisplay: e.detail.due,
      members: e.detail.people || [],
      labels: Array.isArray(e.detail.labels) ? e.detail.labels : [],
      badges: ensureBadgeTypes(Array.isArray(e.detail.badges) ? e.detail.badges : []),
      description: (e.detail.description ?? deriveDescriptionFromTitle(e.detail.title)), // 👈 prefer Trello
      timers: { time: e.detail.eta || "0m" },
      activity: []
    });
  };
  window.addEventListener("openTrelloCard", handler);
  return () => window.removeEventListener("openTrelloCard", handler);
}, []);

  useEffect(() => {
    const close = (e) => {
      // ignore clicks originating inside the menu or the button
      if (e.target.closest?.(".kebab-wrap")) return;
      setTrelloMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // NEW: track pending custom field updates to avoid flicker
  useEffect(() => {
    function onPendingCF(e) {
      const { cardId, field, ttlMs = 1500 } = e.detail || {}; // shorten to reduce lag
      if (!cardId || !field) return;
      const now = Date.now();
      const m = pendingCFRef.current;
      const rec = m.get(cardId) || {};
      rec[field] = now + ttlMs;
      m.set(cardId, rec);
    }
    window.addEventListener("pendingCF", onPendingCF);
    return () => window.removeEventListener("pendingCF", onPendingCF);
  }, []);

  useEffect(() => {
  function onBucketsUpdated(e) {
    try {
      const buckets = (e.detail && e.detail.buckets) || [];
      if (!trelloCard?.id) return;

      // 1) find fresh copy of the open card
      let fresh = null;
      for (const b of buckets) {
        const hit = (b.cards || []).find(x => x.id === trelloCard.id);
        if (hit) { fresh = hit; break; }
      }
      if (!fresh && trelloCard?.title) {
        for (const b of buckets) {
          const hit = (b.cards || []).find(
            x => (x.title || "").trim() === (trelloCard.title || "").trim()
          );
          if (hit) { fresh = hit; break; }
        }
      }
      if (!fresh) return;

      // 2) which CFs are pending from THIS modal?
      const now = Date.now();
      const pend = pendingCFRef.current.get(trelloCard.id) || {};
      const isPending = (field) => pend[field] && pend[field] > now;

      // 3) build next badges (ensure .type is present for colors)
      const modalBadges = ensureBadgeTypes(Array.isArray(trelloCard.badges) ? trelloCard.badges : []);
      const freshBadges = ensureBadgeTypes(Array.isArray(fresh.badges) ? fresh.badges : []);

      const pick = (labelRegex, fieldName) => {
        const src = isPending(fieldName) ? modalBadges : freshBadges;
        return src.find(b => labelRegex.test(b?.text || "")) || null;
      };

      const nextBadges = [];
      const prio = pick(/^Priority\s*:/i, "Priority"); if (prio) nextBadges.push(prio);
      const act  = pick(/^Active\s*:/i,   "Active");   if (act)  nextBadges.push(act);
      const stat = pick(/^Status\s*:/i,   "Status");   if (stat) nextBadges.push(stat);

      freshBadges.forEach(b => {
        const t = b?.text || "";
        if (!/^Priority\s*:/i.test(t) && !/^Active\s*:/i.test(t) && !/^Status\s*:/i.test(t)) {
          nextBadges.push(b);
        }
      });

      // ensure the final array has types (e.g., Active/Priority) for consistent coloring
      const nextBadgesEnsured = ensureBadgeTypes(nextBadges);

      const needsUpdate =
        JSON.stringify(nextBadgesEnsured) !== JSON.stringify(modalBadges) ||
        JSON.stringify(trelloCard.labels || []) !== JSON.stringify(fresh.labels || []) ||
        (trelloCard.boardList || "") !== (fresh.list || "") ||
        (trelloCard.listId ?? null)   !== (fresh.listId ?? null) ||
        (trelloCard.description || "") !== (fresh.description || "");  

      if (needsUpdate) {
        setTrelloCard(prev => ({
          ...prev,
          badges: nextBadgesEnsured,
          labels: Array.isArray(fresh.labels) ? [...fresh.labels] : [],
          boardList: fresh.list ?? prev.boardList,
          listId: fresh.listId ?? prev.listId,
          description: fresh.description ?? prev.description, // 👈 NEW: sync description
        }));
      }
    } catch (err) {
      console.error("onBucketsUpdated failed:", err);
    }
  }

  window.addEventListener("bucketsUpdated", onBucketsUpdated);
  return () => window.removeEventListener("bucketsUpdated", onBucketsUpdated);
}, [trelloCard?.id, setTrelloCard]);

  const detectContact = (text, fallback) => {
    const hit = AC_CONTACTS.find((n) => text.includes(n));
    return hit || fallback;
  };

        const onNotificationClick = async (n) => {
    // 🟢 Trello notifications (existing behaviour)
    if (n.alt === "Trello") {
      setTrelloMenuOpen(false);
      setCurrentView({ app: "trello", contact: null });
      setTrelloCard(buildTrelloCardFromNotif(n.text));
      return;
    }

    // 📨 Gmail-style notifications from Data Centre (Drive)
    if (n.alt === "Gmail" && n.driveEmail) {
      try {
        // ... existing Gmail logic stays exactly as you had it ...
        const res = await fetch("/.netlify/functions/drive-get-source-docs");
        const json = await res.json().catch(() => ({}));
        const pdfFiles = (json.files || []).filter(
          (f) => f.mimeType === "application/pdf"
        );

        const attachments = pdfFiles.map((f) => {
          const mime = f.mimeType || "application/pdf";
          const baseUrl = `/.netlify/functions/drive-download?id=${encodeURIComponent(
            f.id
          )}&name=${encodeURIComponent(f.name)}&mimeType=${encodeURIComponent(mime)}`;

          return {
            id: f.id,
            name: f.name,
            type: "pdf",
            url: baseUrl,
            thumbUrl: f.thumbnailLink || f.webViewLink || baseUrl,
          };
        });

        let bodyText = "But the original .eml is stored in the Data Centre.";
        try {
          const bodyRes = await fetch(
            `/.netlify/functions/drive-get-eml?id=${encodeURIComponent(
              n.driveEmail.id
            )}`
          );
          const bodyJson = await bodyRes.json().catch(() => ({}));
          if (bodyJson && bodyJson.ok && bodyJson.bodyText) {
            bodyText = bodyJson.bodyText;
          }
        } catch (err) {
          console.error("Failed to fetch .eml body:", err);
        }

        const subject =
          (n.driveEmail.subject && n.driveEmail.subject.trim()) ||
          n.driveEmail.name.replace(/\.eml$/i, "") ||
          "Client Instruction (Data Centre)";

        setEmailPreview(null);
        setEmail({
          id: n.driveEmail.id,
          subject,
          fromName: "Client Instruction (Data Centre)",
          fromEmail: "via Data Centre <agentyolandie@gmail.com>",
          to: ["Yolandie <yolandie@actuaryspace.co.za>"],
          time: n.time,
          body: bodyText,
          attachments,
          actions: [
            { key: "submit_trello", label: "Submit to Trello" },
            { key: "update_tracker", label: "Update AC Tracker" },
          ],
        });

        window.dispatchEvent(
          new CustomEvent("setClientFiles", {
            detail: { files: attachments },
          })
        );

        setCurrentView({ app: "email", contact: null });
      } catch (err) {
        console.error("Failed to open email from notification:", err);
      }

      return;
    }
  };

  /* dismiss notif */
  const dismissNotification = (id) => {

    setNotifications((prev) => prev.filter((x) => x.id !== id));
  };

  /* composer sizing */
  const handleAutoGrow = (ta) => {
    if (!ta) return;
    const maxLines = 10;
    const lh = parseFloat(getComputedStyle(ta).lineHeight || "22");
    const max = lh * maxLines;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, max) + "px";
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
    const chatBar = ta.closest(".chat-bar");
    const isExpanded = ta.scrollHeight > lh * 1.6;
    if (chatBar) chatBar.classList.toggle("expanded", isExpanded);
  };

  /* Email actions (real Trello + Tracker + Create Draft) */
const handleEmailAction = (actionKey) => {
  if (!email) return;

  // for now, use a demo Case Card text so you can test end-to-end
  const caseCardText = DEMO_CASE_CARD_TEXT;

  // helper to extract AC REF from subject (used for tracker fallback)
  const extractACRef = (subjectRaw) => {
    const m = (subjectRaw || "").match(/AC REF[:\s]*([A-Z0-9]+)/i);
    return m ? m[1].trim() : "";
  };

  /* SUBMIT TO TRELLO */
  if (actionKey === "submit_trello") {
    const instructionTimeIso = new Date().toISOString(); // now; later you can pass the real email time

    fetch("/.netlify/functions/trello-create-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseCardText,
        instructionTimeIso,
        fallbackDescription: email.subject || "",
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!json || json.ok === false) {
          console.error("trello-create-card error:", json);
          setEmail((prev) =>
            prev
              ? {
                  ...prev,
                  systemNote:
                    "Tried to submit to Trello but something went wrong. Please check the console.",
                }
              : prev
          );
        } else {
          setEmail((prev) =>
            prev
              ? {
                  ...prev,
                  systemNote: "Submitted to Trello and linked to AC REF.",
                }
              : prev
          );
        }
      })
      .catch((err) => {
        console.error("trello-create-card fetch failed:", err);
        setEmail((prev) =>
          prev
            ? {
                ...prev,
                systemNote:
                  "Tried to submit to Trello but the request failed. Please check the console.",
              }
            : prev
        );
      });

    return;
  }

  /* UPDATE AC TRACKER (simple, as before) */
  if (actionKey === "update_tracker") {
  // 👇 For now, reuse the Case Card text you already have.
  // Eventually you’ll plug in the REAL .txt content from Drive.
  const caseCardText = DEMO_CASE_CARD_TEXT; // or whatever you have

  fetch("/.netlify/functions/sheet-update-tracker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseCardText }),
  })
    .then((res) => res.json())
    .then((json) => {
      if (json.ok) {
        setEmail((prev) =>
          prev
            ? {
                ...prev,
                systemNote: "AC Reports Tracker updated for this case.",
              }
            : prev
        );
      } else {
        setEmail((prev) =>
          prev
            ? {
                ...prev,
                systemNote:
                  "Tracker update failed. See console for details.",
              }
            : prev
        );
        console.error("sheet-update-tracker error:", json);
      }
    })
    .catch((err) => {
      console.error("sheet-update-tracker fetch failed:", err);
      setEmail((prev) =>
        prev
          ? { ...prev, systemNote: "Tracker update failed (network error)." }
          : prev
      );
    });

  return;
}

  /* CREATE DRAFT – open the template picker */
  if (actionKey === "create_draft") {
    setShowDraftPicker((v) => !v);
    setSelectedDraftTemplate(null);
    setEmail((prev) =>
      prev
        ? {
            ...prev,
            systemNote: "Choose a draft template below.",
          }
        : prev
    );
    return;
  }

  /* CANCEL */
  setEmail((prev) =>
    prev ? { ...prev, systemNote: "Action cancelled." } : prev
  );
};

  /* send + auto reply (WhatsApp only) */
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;

    if (currentView.app === "whatsapp" && currentView.contact) {
      const contact = currentView.contact;

      setWaChats((prev) => {
        const list = prev[contact] ? [...prev[contact]] : [];
        list.push({ from: "me", text, time: formatUKTime(new Date()) });
        return { ...prev, [contact]: list };
      });

      const delay = 1000 + Math.floor(Math.random() * 2000);
      const reply =
        WA_AUTO_REPLIES[Math.floor(Math.random() * WA_AUTO_REPLIES.length)];

      setTimeout(() => {
        setWaChats((prev) => {
          const list = prev[contact] ? [...prev[contact]] : [];
          list.push({ from: "them", text: reply, time: formatUKTime(new Date()) });
          return { ...prev, [contact]: list };
        });
      }, delay);

      // clear input after sending
      setInputValue("");
      const ta = document.querySelector(".chat-textarea");
      if (ta) {
        ta.style.height = "auto";
        ta.style.overflowY = "hidden";
        const chatBar = ta.closest(".chat-bar");
        if (chatBar) chatBar.classList.remove("expanded");
      }
    }
  };

  /* middle renderer */
  const middleContent = useMemo(() => {
    if (currentView.app === "whatsapp" && currentView.contact) {
      const msgs = waChats[currentView.contact] || [];
      return (
        <div className="wa-chat">
          <div className="wa-header">
            <div className="wa-avatar">
              {avatarFor(currentView.contact)
                ? <img src={avatarFor(currentView.contact)} alt={currentView.contact} />
                : <span>{currentView.contact?.slice(0,1)}</span>}
            </div>
            <div className="wa-meta">
              <div className="wa-name">{currentView.contact}</div>
              <div className="wa-status">online</div>
            </div>
          </div>
          <div className="wa-body" ref={waBodyRef}>
            {msgs.map((m, idx) => (
              <div key={idx} className={`wa-msg ${m.from}`}>
                <div className="wa-bubble">
                  <div className="wa-text">{m.text}</div>
                  <div className="wa-time">
                    {m.time}
                    {m.from === "me" && <span className="wa-ticks">✔✔</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

        if (currentView.app === "email") {
      const att = (email && email.attachments) || [];
      const actions = (email && email.actions) || [];

      const emailPane = (
        <div className="email-pane">
          <div className="email-head">
            <div className="email-from">
              <div className="email-from-name">{email.fromName}</div>
              <div className="email-from-email">{email.fromEmail}</div>
            </div>
            <div className="email-meta">
              <div className="email-subject">{email.subject}</div>
              <div className="email-time">{email.time}</div>
            </div>
          </div>

          <div className="email-body">
            {email.bodyHtml ? (
              <div
                className="email-body-html"
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <pre className="email-body-pre">{email.body || ""}</pre>
            )}
            {email.systemNote ? (
              <div className="email-note">{email.systemNote}</div>
            ) : null}
          </div>

          {/* ACTIONS: Trello / Tracker + Create Draft */}
          <div className="email-actions">
            {actions.map((a) => (
              <button
                key={a.key}
                className="email-action-btn"
                onClick={() => handleEmailAction(a.key)}
              >
                {a.label}
              </button>
            ))}

            <button
              className="email-action-btn"
              onClick={() => setShowDraftPicker((v) => !v)}
            >
              Create Draft
            </button>
          </div>

          {/* Attachments header + grid FIRST */}
          {att.length > 0 && (
            <>
              <div className="email-attach-title">
                {att.length} Attachment{att.length > 1 ? "s" : ""}
              </div>
              <div className="email-attach-grid">
                {att.map((f, i) => (
                  <button
                    key={i}
                    className="email-attach"
                    onClick={() => setEmailPreview(f)}
                    title={f.name}
                  >
                    <div className="email-attach-preview">
                      <iframe
                        className="email-attach-frame"
                        title={f.name}
                        src={f.url}
                      />
                    </div>
                    <div className="email-attach-footer">
                      <span className="email-attach-icon">
                        {f.type ? f.type.toUpperCase() : "FILE"}
                      </span>
                      <span className="email-attach-name">{f.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 🔽 TEMPLATE PICKER – under attachments */}
          {showDraftPicker && (
            <div className="draft-picker">
              <div className="draft-picker-title">
                Choose a draft email template:
              </div>
              <div className="draft-picker-list">
                {DRAFT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    className="draft-picker-item"
                    onClick={() => {
                      setSelectedDraftTemplate(tpl);
                      setDraftTo(""); // clear recipients
                      setShowDraftPicker(false);
                    }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Draft editor with To / Cancel / Send */}
          {selectedDraftTemplate && (
            <div className="email-draft-preview">
              {/* To: field */}
              <div className="email-draft-header">
                <div className="email-draft-row">
                  <span className="email-draft-label">To</span>
                  <input
                    type="text"
                    className="email-draft-to"
                    placeholder="e.g. roshan@dhllaw.co.za, tinashe@dhllaw.co.za"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Title + Cancel + Send */}
              <div className="email-draft-toolbar">
                <div className="email-draft-title">
                  Draft: {selectedDraftTemplate.label}
                </div>
                <div className="email-draft-actions">
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setSelectedDraftTemplate(null);
                      setShowDraftPicker(false);
                      setDraftTo("");
                      setEmail((prev) =>
                        prev ? { ...prev, systemNote: undefined } : prev
                      );
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    className="btn blue"
                    onClick={async () => {
                      if (!draftTo.trim()) {
                        setEmail((prev) =>
                          prev
                            ? {
                                ...prev,
                                systemNote:
                                  "Please add at least one recipient email address before sending.",
                              }
                            : prev
                        );
                        return;
                      }

                          try {
                          const res = await fetch("/.netlify/functions/gmail-send-email", {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              to: draftTo,
                              subject: email.subject || "(no subject)",
                              body: selectedDraftTemplate.body,
                            }),
                          });

                          const json = await res.json().catch(() => ({}));
                          if (!res.ok || json.ok === false) {
                            throw new Error(json.error || `HTTP ${res.status}`);
                          }

                          // ✅ Update email note
                          setEmail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  systemNote: `Email sent successfully to: ${draftTo}`,
                                }
                              : prev
                          );

                          // reset draft
                          setSelectedDraftTemplate(null);
                          setDraftTo("");
                        } catch (err) {
                          setEmail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  systemNote: `Sending failed: ${
                                    err?.message || String(err)
                                  }`,
                                }
                              : prev
                          );
                        }
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Editable body */}
              <textarea
                className="email-draft-textarea"
                value={selectedDraftTemplate.body}
                onChange={(e) =>
                  setSelectedDraftTemplate((prev) =>
                    prev ? { ...prev, body: e.target.value } : prev
                  )
                }
              />
            </div>
          )}
        </div>
      );

      const previewPane = emailPreview ? (
        <div className="email-preview">
          <div className="email-preview-bar">
            <div className="email-preview-name">{emailPreview.name}</div>
            <button
              className="email-preview-close"
              onClick={() => setEmailPreview(null)}
            >
              Close
            </button>
          </div>
          <iframe
            className="email-preview-frame"
            title={emailPreview.name}
            src={emailPreview.url}
          />
        </div>
      ) : null;

      // Full width until an attachment is clicked, then split view
      return emailPreview ? (
        <div className="email-split">
          {emailPane}
          {previewPane}
        </div>
      ) : (
        <div className="email-full">{emailPane}</div>
      );
    }

    /* Trello modal center popup */
    if (currentView.app === "trello" && trelloCard) {
      const c = trelloCard;
      // IMPORTANT: prefer real customFields; only fallback to badges if missing/empty
      const fields = (c.customFields && Object.keys(c.customFields).length)
        ? c.customFields
        : parseCustomFieldsFromBadges(c.badges || []);

      return (
        <div className="trello-modal">
          <div className="trello-modal-topbar">
            <div className="trello-top-left">
              <button className="tl-list-dropdown">{c.boardList || "Yolandie to Send"} ▾</button>
            </div>

            <div className="trello-top-right">
              <div className="kebab-wrap">
                <button
                  className="kebab-btn"
                  aria-label="More"
                  onClick={(e) => { e.stopPropagation(); setTrelloMenuOpen(v => !v); }}
                >⋯</button>

                {trelloMenuOpen && (
                  <div className="kebab-menu" onMouseLeave={() => setTrelloMenuOpen(false)}>
                    <button className="k-item">Join</button>
                    <button className="k-item">Move</button>
                    <button className="k-item">Copy</button>
                    <button className="k-item">Mirror</button>
                    <button className="k-item">Make template</button>
                    <button className="k-item">Watch</button>
                    <div className="k-sep" />
                    <button className="k-item">Share</button>
                    <button className="k-item">Archive</button>
                  </div>
                )}
              </div>

              <button
              className="trello-close"
              onClick={() => {
                setTrelloMenuOpen(false);
                setDescEditing(false);   // 👈 NEW
                setDescDraft("");        // 👈 NEW
                setTrelloCard(null);
              }}
            >✕</button>
            </div>
          </div>

          <div className="trello-modal-body">
            <div className="trello-left">
              <div className="trello-title">
                <div className="t-title-text"><strong>{c.title}{c.dueDisplay ? ` ${c.dueDisplay}` : ""}</strong></div>
              </div>

              <div className="trello-modal-toolbar">
                <button className="tool-btn">+ Add</button>
                <button className="tool-btn">Dates</button>
                <button className="tool-btn">Checklist</button>
                <button className="tool-btn">Attachment</button>
                <button className="tool-btn">Location</button>
              </div>

              <div className="tl-row">
                <div className="tl-label">Members</div>
                <div className="tl-chips">
                  {(c.members || []).map((m, i) => {
                    const img = avatarFor(m);
                    return img
                      ? <img key={i} className="tl-chip-img" src={img} alt={m} title={m} />
                      : <div key={i} className="tl-chip" title={m}>{(m||"").slice(0,1)}</div>;
                  })}
                  <button className="tl-chip add">+</button>
                </div>
              </div>

              <div className="tl-row">
                <div className="tl-label">Labels</div>
                <div className="dd">
                  <select
                    value={(c.labels && c.labels[0]) || ""}
                    onChange={(e) => {
                      const val = e.target.value || "";
                      setTrelloCard(prev => ({ ...prev, labels: val ? [val] : [] }));
                    }}
                  >
                    <option value="" disabled>Select…</option>
                    {LABEL_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tl-row">
                <div className="tl-label">Labels</div>
                <div className="tl-chips">
                  {(c.labels || []).map((l, i) => <div className="tl-tag raf" key={i}>{l}</div>)}
                  <button className="tl-chip add">+</button>
                </div>
              </div>

              <div className="tl-row">
  <div className="tl-label">Description</div>

  {!descEditing ? (
    <div className="tl-card-like">
      <div className="tl-desc">{c.description || <span style={{color:"#777"}}>No description.</span>}</div>
      <button
        className="btn ghost"
        onClick={() => { setDescDraft(c.description || ""); setDescEditing(true); }}
      >
        Edit
      </button>
    </div>
  ) : (
    <div className="tl-card-like" style={{ flexDirection:"column", alignItems:"stretch", gap:8 }}>
      <textarea
        value={descDraft}
        onChange={(e) => setDescDraft(e.target.value)}
        rows={5}
        style={{
          width:"100%", resize:"vertical",
          border:"1px solid #ddd", borderRadius:10, padding:10, fontFamily:"inherit", fontSize:".92rem"
        }}
        placeholder="Write a description…"
      />
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button className="btn ghost" onClick={() => { setDescEditing(false); setDescDraft(""); }}>
          Cancel
        </button>
        <button
          className="btn blue"
          onClick={async () => {
            const newDesc = descDraft;
            const prevDesc = c.description || "";

            // optimistic UI
            setTrelloCard(prev => ({ ...prev, description: newDesc }));
            setDescEditing(false);

            try {
              await setCardDescription(c.id, newDesc);
              // also patch the right pane instantly (optional but nice)
              window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                detail: {
                  cardId: c.id,
                  updater: (old) => ({ ...old, description: newDesc })
                },
              }));
            } catch (err) {
              // rollback on error
              setTrelloCard(prev => ({ ...prev, description: prevDesc }));
              window.dispatchEvent(new CustomEvent("notify", {
                detail: { text: `Description update failed: ${String(err.message || err)}`, cardId: c.id }
              }));
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  )}
</div>

              <div className="tl-row">
                <div className="tl-label">Priority</div>
                <div className="dd">
                  {(() => {
                    const p = (fields.priority || "").toUpperCase();
                    const priorityClass =
                      p === "HIGH URGENT"                    ? "prio-green"  :
                      p === "URGENT + IMPORTANT"             ? "prio-red"    :
                      (p === "URGENT" || p === "NEW CLIENT") ? "prio-purple" : "prio-default";

                    return (
                      <select
                        className={`prio-select ${priorityClass}`}
                        value={fields.priority || ""}
                        onChange={async (e) => {
                          const val = e.target.value;
                          const prevVal = fields.priority || "";

                          const canon = canonicalPriority(val);
                          const prioType = priorityTypeFromText(canon);

                          // optimistic UI – modal (include color class)
                          setTrelloCard(prev => ({
                            ...prev,
                            badges: [
                              ...(prev.badges || []).filter(b => !/^Priority\s*:/i.test(b.text || "")),
                              ...(canon ? [{ text: `Priority: ${canon}`, type: prioType }] : []),
                            ],
                          }));

                          // optimistic UI – right columns (use CANON, not val)
                          window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                            detail: {
                              cardId: c.id,
                              updater: (old) => {
                                const others = (old.badges || []).filter(b => !/^Priority\s*:/i.test(b.text || ""));
                                const prio   = canon ? [{ text: `Priority: ${canon}`, type: prioType }] : [];
                                return { ...old, badges: [...prio, ...others] };
                              },
                            },
                          }));

                          // mark pending a bit longer than poll interval
                          window.dispatchEvent(new CustomEvent("pendingCF", {
                            detail: { cardId: c.id, field: "Priority", ttlMs: 1500 }
                          }));

                          try {
                            await setCardCustomField(c.id, "Priority", canon || null);
                          } catch (err) {
                            console.error("Priority update failed", err);

                            // rollback – modal
                            setTrelloCard(prev => ({
                              ...prev,
                              badges: [
                                ...(prev.badges || []).filter(b => !/^Priority\s*:/i.test(b.text || "")),
                                ...(prevVal ? [{ text: `Priority: ${prevVal}` }] : []),
                              ],
                            }));

                            // rollback – right columns (via event)
                            window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: {
                                cardId: c.id,
                                updater: (old) => ({
                                  ...old,
                                  badges: [
                                    ...(old.badges || []).filter(b => !/^Priority\s*:/i.test(b.text || "")),
                                    ...(prevVal ? [{ text: `Priority: ${prevVal}` }] : []),
                                  ],
                                }),
                              },
                            }));

                            window.dispatchEvent(new CustomEvent("notify", {
                              detail: { text: `Priority update failed: ${String(err.message || err)}`, cardId: c.id }
                            }));
                          }
                        }}
                      >
                        <option value="" disabled>Select…</option>
                        <option>HIGH URGENT</option>
                        <option>URGENT + IMPORTANT</option>
                        <option>URGENT</option>
                        <option>NEW CLIENT</option>
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div className="tl-row">
  <div className="tl-label">Active</div>
  <div className="dd">
    {(() => {
      const a = fields.active || "";
      const activeClass =
        a ? activeTypeFromText(a) : "active-default"; // color the select head

      return (
        <select
          className={`active-select ${activeClass}`}
          value={a}
          onChange={async (e) => {
            const val = e.target.value;
            const prevVal = fields.active || "";
            const valType = activeTypeFromText(val);

            // optimistic UI – modal (include type so badge is colored immediately)
            setTrelloCard(prev => ({
              ...prev,
              badges: ensureBadgeTypes([
                ...(prev.badges || []).filter(b => !/^Active\s*:/i.test(b.text || "")),
                ...(val ? [{ text: `Active: ${val}`, type: valType }] : []),
              ]),
            }));

            // optimistic UI – right columns (also include type)
            window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
              detail: {
                cardId: c.id,
                updater: (old) => {
                  const others = (old.badges || []).filter(b => !/^Active\s*:/i.test(b.text || ""));
                  const act = val ? [{ text: `Active: ${val}`, type: valType }] : [];
                  return { ...old, badges: ensureBadgeTypes([...act, ...others]) };
                },
              },
            }));

            // tell both panes a write is pending
            window.dispatchEvent(new CustomEvent("pendingCF", {
              detail: { cardId: c.id, field: "Active", ttlMs: 1500 }
            }));

            try {
              await setCardCustomField(c.id, "Active", val || null);
            } catch (err) {
              console.error("Active update failed", err);

              // rollback – modal
              setTrelloCard(prev => ({
                ...prev,
                badges: ensureBadgeTypes([
                  ...(prev.badges || []).filter(b => !/^Active\s*:/i.test(b.text || "")),
                  ...(prevVal ? [{ text: `Active: ${prevVal}`, type: activeTypeFromText(prevVal) }] : []),
                ]),
              }));

              // rollback – right columns
              window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                detail: {
                  cardId: c.id,
                  updater: (old) => ({
                    ...old,
                    badges: ensureBadgeTypes([
                      ...(old.badges || []).filter(b => !/^Active\s*:/i.test(b.text || "")),
                      ...(prevVal ? [{ text: `Active: ${prevVal}`, type: activeTypeFromText(prevVal) }] : []),
                    ]),
                  }),
                },
              }));

              window.dispatchEvent(new CustomEvent("notify", {
                detail: { text: `Active update failed: ${String(err.message || err)}`, cardId: c.id }
              }));
            }
          }}
        >
          <option value="" disabled>Select…</option>
          {ACTIVE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    })()}
  </div>
</div>

              <div className="tl-row">
  <div className="tl-label">Status</div>
  <div className="dd">
    {(() => {
      const s = fields.status || "";
      const statusClass = statusTypeFromText(s);

      return (
        <select
          className={`status-select ${statusClass}`}
          value={s}
          onChange={async (e) => {
            const val = e.target.value;
            const prevVal = fields.status || "";
            const valType = statusTypeFromText(val);

            // optimistic UI – modal
            setTrelloCard(prev => ({
              ...prev,
              badges: ensureBadgeTypes([
                ...(prev.badges || []).filter(b => !/^Status\s*:/i.test(b.text || "")),
                ...(val ? [{ text: `Status: ${val}`, type: valType }] : []),
              ]),
            }));

            // optimistic UI – right columns
            window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
              detail: {
                cardId: c.id,
                updater: (old) => {
                  const others = (old.badges || []).filter(b => !/^Status\s*:/i.test(b.text || ""));
                  const stat = val ? [{ text: `Status: ${val}`, type: valType }] : [];
                  return { ...old, badges: ensureBadgeTypes([...stat, ...others]) };
                },
              },
            }));

            // mark pending
            window.dispatchEvent(new CustomEvent("pendingCF", {
              detail: { cardId: c.id, field: "Status", ttlMs: 1500 }
            }));

            try {
              await setCardCustomField(c.id, "Status", val || null);
            } catch (err) {
              console.error("Status update failed", err);
              // rollback modal
              setTrelloCard(prev => ({
                ...prev,
                badges: ensureBadgeTypes([
                  ...(prev.badges || []).filter(b => !/^Status\s*:/i.test(b.text || "")),
                  ...(prevVal ? [{ text: `Status: ${prevVal}`, type: statusTypeFromText(prevVal) }] : []),
                ]),
              }));
              // rollback right
              window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                detail: {
                  cardId: c.id,
                  updater: (old) => ({
                    ...old,
                    badges: ensureBadgeTypes([
                      ...(old.badges || []).filter(b => !/^Status\s*:/i.test(b.text || "")),
                      ...(prevVal ? [{ text: `Status: ${prevVal}`, type: statusTypeFromText(prevVal) }] : []),
                    ]),
                  }),
                },
              }));
              window.dispatchEvent(new CustomEvent("notify", {
                detail: { text: `Status update failed: ${String(err.message || err)}`, cardId: c.id }
              }));
            }
          }}
        >
          <option value="" disabled>Select…</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    })()}
  </div>
</div>

              <div className="tl-row">
                <div className="tl-label">Move to…</div>
                <div className="dd">
                  <select
                    value={c.boardList || ""}
                    onChange={(e) => {
                      const nextList = e.target.value;
                      // Update local modal state for instant UI feedback
                      setTrelloCard(prev => ({ ...prev, boardList: nextList, listId: null }));
                      // Fire a global event we can wire to real Trello move later
                      window.dispatchEvent(new CustomEvent("trelloMoveRequested", {
                        detail: { cardId: c.id, toListName: nextList }
                      }));
                    }}
                  >
                    <option value="" disabled>Select…</option>
                    {PERSONA_TRELLO_LISTS.map((listName) => (
                      <option key={listName} value={listName}>
                        {listName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tl-row">
                <div className="tl-label">Activity timer</div>
                <div className="tl-actions-inline">
                  <button className="btn blue">Start timer</button>
                  <span className="timer-pill">0m</span>
                  <button className="btn ghost">Estimate: 0m</button>
                </div>
              </div>

              <div className="tl-row">
                <div className="tl-label">Time</div>
                <div className="tl-actions-inline">
                  <button className="btn ghost">Start Timer</button>
                  <span className="timer-pill">{c.timers?.time || "0m"}</span>
                </div>
              </div>
            </div>

            <div className="trello-right">
              <div className="tr-head">
                <div className="tr-title">Comments and activity</div>
                <button className="btn ghost sm">Show details</button>
              </div>
              <input className="tr-comment" placeholder="Write a comment…" />
              <div className="tr-feed">
                {(c.activity || []).map((a, i) => (
                  <div key={i} className="tr-item">
                    <div className="tr-avatar">
                      {avatarFor(a.who) ? <img src={avatarFor(a.who)} alt={a.who}/> : <div className="tr-initial">{a.who.slice(0,1)}</div>}
                    </div>
                    <div className="tr-bubble">
                      <div className="tr-meta">
                        <span className="tr-name">{a.who}</span>
                        <span className="tr-time">{a.time}</span>
                      </div>
                      <div className="tr-text">{a.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <div className="chat-output" />;
      }, [
      currentView,
      waChats,
      email,
      emailPreview,
      trelloCard,
      trelloMenuOpen,
      descEditing,
      descDraft,
      showDraftPicker,
      selectedDraftTemplate,
      draftTo,
    ]);

  return (
  <PasswordGate>
    <div className="app">
      {/* LEFT */}
      <div className="left-panel">
        <div className="panel-title">Notifications</div>
        <div className="notifications">
          {notifications.map((n) => (
            <div
              className={`notification ${n.alt.toLowerCase()}`}
              key={n.id}
              onClick={() => onNotificationClick(n)}
              style={{ position: "relative" }}
            >
              <img src={n.icon} alt={n.alt} className="icon" />
              <span>[{n.time}] {n.alt}: {n.text}</span>
              {n.alt === "Gmail" && <span className="notif-chip">Email</span>}
              <button
                className="notif-close"
                title="Dismiss"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification(n.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE */}
      <div
        className={`middle-panel ${
          currentView.app === "email" && emailPreview ? "has-email-preview" : ""
        }`}
      >
        <div className="panel-title">
          {currentView.app === "whatsapp" && currentView.contact
            ? `WhatsApp — ${currentView.contact}`
            : currentView.app === "email"
            ? `Gmail — ${email.subject}`
            : currentView.app === "trello"
            ? `Trello — Card`
            : "Chat / Gemini Output"}
        </div>

        <div className="middle-content">{middleContent}</div>

        <div className="chat-bar">
          <textarea
            className="chat-textarea"
            placeholder={
              currentView.app === "whatsapp" && currentView.contact
                ? `Message ${currentView.contact}`
                : currentView.app === "email"
                ? "Add a note or instruction about this email"
                : "Ask anything"
            }
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            ref={handleAutoGrow}
            onInput={(e) => handleAutoGrow(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          {inputValue.trim() && (
            <button className="send-btn" onClick={handleSend} aria-label="Send">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <RightPanel />
    </div>
  </PasswordGate>
);
}
