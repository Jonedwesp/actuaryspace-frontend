// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import trelloIcon from "./assets/Trello Pic.png";
import gmailIcon from "./assets/Gmail pic.png";
import whatsappIcon from "./assets/WhatsApp.png";
import gchatIcon from "./assets/Google Chat.png";

const PERSONA = import.meta.env.VITE_PERSONA || "UNKNOWN";

const PERSONA_TRELLO_LISTS =
  PERSONA.toUpperCase() === "SIYA"
    ? [
        "Siya - Review", // Requested at Top
        "Siya",
        "Bonolo S",      // Team member
        "Bonisa",        // Team member
        "Songeziwe",     // Team member
        "Enock"          // Team member
      ]
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
          ActuarySpace — {PERSONA.toUpperCase() === "YOLANDIE" ? "Yolandie" : PERSONA.toUpperCase() === "SIYA" ? "Siya" : "Unknown"}
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

function formatGchatTime(isoString) {
  if (!isoString) return "";

  const now = new Date();
  const msgTime = new Date(isoString);

  const diffMs = now - msgTime;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  const diffHr = diffMin / 60;

  const sameDay =
    now.getFullYear() === msgTime.getFullYear() &&
    now.getMonth() === msgTime.getMonth() &&
    now.getDate() === msgTime.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    msgTime.getFullYear() === yesterday.getFullYear() &&
    msgTime.getMonth() === yesterday.getMonth() &&
    msgTime.getDate() === yesterday.getDate();

  // 1. within last hour → "32min"
  if (diffMin < 60) {
    return `${diffMin}min`;
  }

  // 2. today but >1 hour → "10:34 AM"
  if (sameDay) {
    return msgTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // 3. yesterday → "Yesterday, 10:34 AM"
  if (isYesterday) {
    return `Yesterday, ${msgTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  // calendar days difference (more reliable than diffHr/24)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsgDay = new Date(msgTime.getFullYear(), msgTime.getMonth(), msgTime.getDate());
  const daysAgo = Math.floor((startOfToday - startOfMsgDay) / 86400000);

  // 4. 2–6 days ago
  if (daysAgo >= 2 && daysAgo <= 6) {
    return msgTime.toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // 5. ≥ 7 days ago → "Jan 23, 09:15 PM"
  return `${msgTime.toLocaleString("en-US", { month: "short" })} ${msgTime.getDate()}, ${msgTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function normalizeGChatMessage(m) {
  return m?.message || m;
}

function getMsgTs(m) {
  const msg = normalizeGChatMessage(m);
  return new Date(msg?.createTime || msg?.updateTime || 0).getTime();
}

function msgKey(m) {
  const msg = normalizeGChatMessage(m);
  return msg?.name || msg?.id || "";
}

function dedupeMergeMessages(prev, incoming) {
  const seen = new Set((prev || []).map((m) => msgKey(m)).filter(Boolean));
  const merged = [...(prev || [])];

  for (const m of incoming || []) {
    const msg = normalizeGChatMessage(m);
    const k = msgKey(msg);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(msg);
  }

  merged.sort((a, b) => getMsgTs(a) - getMsgTs(b));
  return merged;
}

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

/* --- CUSTOM FIELD OPTIONS & COLORS --- */

const PRIORITY_OPTIONS = [
  "HIGH URGENT",
  "URGENT + IMPORTANT",
  "URGENT",
  "NEW CLIENT"
];

const ACTIVE_OPTIONS = [
  "Working on it",
  "Not working on it",
  "Do not move card"
];

const STATUS_OPTIONS = [
  "To Do - RAF",
  "To Do - Other",
  "Doing",
  "Data Review",
  "Asking IP",
  "Ready to be reviewed - 24hr",
  "Ready to be reviewed - URGENT",
  "Ready to be reviewed - New Client Urgent",
  "Ready to be reviewed - Longer Cases",
  "2nd Review",
  "Analyst to Update",
  "Reviewer Respond",
  "Ready To Send",
  "Waiting for client info",
  "Approved",
  "Actuary Expert",
  "Pause",
  "Asking Senior Analyst",
  "Capturing Data",
  "Checklist Doing"
];

// Helper: Get the CSS class for the Select Box based on the selected value
function getCFColorClass(field, value) {
  const v = (value || "").trim();
  if (!v) return "cf-grey-light"; // Default

  // --- PRIORITY ---
  if (field === "Priority") {
    if (v === "HIGH URGENT") return "cf-green-light";
    if (v === "URGENT + IMPORTANT") return "cf-red-light";
    if (v === "URGENT") return "cf-pink-light";
    if (v === "NEW CLIENT") return "cf-pink-light";
  }

  // --- ACTIVE ---
  if (field === "Active") {
    if (v === "Working on it") return "cf-green-light";
    if (v === "Not working on it") return "cf-orange-light";
    if (v === "Do not move card") return "cf-red-light";
  }

  // --- STATUS ---
  if (field === "Status") {
    // Orange
    if (["To Do - RAF", "Ready to be reviewed - Longer Cases", "Pause"].includes(v)) return "cf-orange-light";
    // Blue
    if (["To Do - Other", "Data Review", "Ready to be reviewed - URGENT", "Analyst to Update", "Actuary Expert"].includes(v)) return "cf-blue-light";
    // Green
    if (["Doing", "Ready To Send", "Capturing Data", "Data Review"].includes(v)) return "cf-green-light";
    // Purple
    if (["Asking IP", "Waiting for client info", "Approved"].includes(v)) return "cf-purple-light";
    // Pink
    if (["Ready to be reviewed - 24hr"].includes(v)) return "cf-pink-light";
    // Yellow
    if (["Ready to be reviewed - New Client Urgent", "Asking Senior Analyst"].includes(v)) return "cf-yellow-light";
    // Grey
    if (["2nd Review", "Checklist Doing"].includes(v)) return "cf-grey-light";
    // Red
    if (["Reviewer Respond"].includes(v)) return "cf-red-light";
  }

  return "cf-grey-light";
}

/* Exact Colors from Screenshot 11 */
const ALL_LABEL_OPTIONS = [
  // Green
  { name: "Breach of Contract", bg: "#baf3db", color: "#164b35" },
  { name: "Paid", bg: "#baf3db", color: "#164b35" },
  { name: "Payment arrangement", bg: "#baf3db", color: "#164b35" },
  { name: "Personal injury", bg: "#baf3db", color: "#164b35" },
  { name: "Financial Loss and Damages", bg: "#4bce97", color: "#164b35" },
  { name: "RAF LOE", bg: "#4bce97", color: "#164b35" },
  { name: "Non-RAF LOE", bg: "#4bce97", color: "#164b35" },
  { name: "Pension Calculations", bg: "#1f845a", color: "#ffffff" },
  
  // Yellow/Gold
  { name: "Labour", bg: "#f8e6a0", color: "#533f04" },
  { name: "Maintenance", bg: "#f5cd47", color: "#533f04" },
  { name: "Investment Portfolio Calc", bg: "#9a782d", color: "#ffffff" },
  { name: "Training", bg: "#9a782d", color: "#ffffff" },
  
  // Orange
  { name: "Innovation", bg: "#ffe2bd", color: "#5f3811" },
  { name: "Medical Expenses", bg: "#ffe2bd", color: "#5f3811" },
  { name: "Past Medical Negligence", bg: "#faa53d", color: "#5f3811" },
  { name: "Arbitration", bg: "#b65c02", color: "#ffffff" },
  
  // Red
  { name: "Benefits Calculation", bg: "#ffd2cc", color: "#5d1f1a" },
  { name: "Bond Calculation", bg: "#ffd2cc", color: "#5d1f1a" },
  { name: "Forensic Audit", bg: "#f87462", color: "#5d1f1a" },
  { name: "RyanGPT", bg: "#c9372c", color: "#ffffff" },
  { name: "Waiting payment", bg: "#c9372c", color: "#ffffff" },
  
  // Purple
  { name: "Broken Contract Calc", bg: "#dfd8fd", color: "#352c63" },
  { name: "Building Model", bg: "#dfd8fd", color: "#352c63" },
  { name: "Other", bg: "#9f8fef", color: "#352c63" },
  { name: "Deceased Estate", bg: "#6e5dc6", color: "#ffffff" },
];

function getLabelStyle(name) {
  const colorClass = getLabelColor(name);
  const colorMap = {
    "label-green-light": { backgroundColor: "#baf3db", color: "#164b35" },
    "label-green-norm": { backgroundColor: "#4bce97", color: "#164b35" },
    "label-green-dark": { backgroundColor: "#1f845a", color: "#ffffff" },
    "label-yellow-light": { backgroundColor: "#f8e6a0", color: "#533f04" },
    "label-yellow-norm": { backgroundColor: "#f5cd47", color: "#533f04" },
    "label-brown-norm": { backgroundColor: "#d3c4a5", color: "#4a3a23" },
    "label-orange-light": { backgroundColor: "#ffe2bd", color: "#5f3811" },
    "label-orange-norm": { backgroundColor: "#faa53d", color: "#5f3811" },
    "label-orange-dark": { backgroundColor: "#b65c02", color: "#ffffff" },
    "label-red-light": { backgroundColor: "#ffd2cc", color: "#5d1f1a" },
    "label-red-norm": { backgroundColor: "#f87462", color: "#5d1f1a" },
    "label-red-dark": { backgroundColor: "#ca3521", color: "#ffffff" },
    "label-purple-light": { backgroundColor: "#dfd8fd", color: "#352c63" },
    "label-purple-norm": { backgroundColor: "#9f8fef", color: "#352c63" },
    "label-purple-dark": { backgroundColor: "#6e5dc6", color: "#ffffff" },
    "label-blue-norm": { backgroundColor: "#579dff", color: "#09326c" },
    "label-default": { backgroundColor: "#091e420f", color: "#172b4d" }
  };
  return colorMap[colorClass] || colorMap["label-default"];
}

// Keep these for backward compatibility
function canonicalPriority(txt) {
  const p = String(txt || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (p.includes("HIGH URGENT")) return "HIGH URGENT";
  if (p.includes("URGENT + IMPORTANT")) return "URGENT + IMPORTANT";
  if (p === "URGENT") return "URGENT";
  if (p.includes("NEW CLIENT")) return "NEW CLIENT";
  return "";
}

function priorityTypeFromText(txt) {
  const p = canonicalPriority(txt);
  return getCFColorClass("Priority", p).replace("cf-", "priority-");
}

function statusTypeFromText(txt) {
  return getCFColorClass("Status", txt).replace("cf-", "status-"); 
}

function activeTypeFromText(txt) {
  return getCFColorClass("Active", txt).replace("cf-", "active-");
}

// Helper to assign specific colors and shades to standard labels
function getLabelColor(text) {
  const t = (text || "").toLowerCase().trim();

  // --- GREEN ---
  // Light Green
  if (["breach of contract", "paid", "payment arrangement", "personal injury"].some(k => t.includes(k))) return "label-green-light";
  // Normal Green
  if (["financial loss", "non-raf loe", "raf loe", "raf los"].some(k => t.includes(k))) return "label-green-norm";
  // Dark Green
  if (["pension calculations"].some(k => t.includes(k))) return "label-green-dark";

  // --- YELLOW ---
  // Light Yellow
  if (["labour"].some(k => t.includes(k))) return "label-yellow-light";
  // Normal Yellow
  if (["maintenance"].some(k => t.includes(k))) return "label-yellow-norm";

  // --- BROWN (Mapped to Trello's Orange/Neutral shades) ---
  // Normal Brown
  if (["investment portfolio", "training"].some(k => t.includes(k))) return "label-brown-norm";

  // --- ORANGE ---
  // Light Orange
  if (["innovation", "medical expenses"].some(k => t.includes(k))) return "label-orange-light";
  // Normal Orange
  if (["past medical negligence"].some(k => t.includes(k))) return "label-orange-norm";
  // Dark Orange
  if (["arbitration"].some(k => t.includes(k))) return "label-orange-dark";

  // --- RED ---
  // Light Red
  if (["benefits calculation", "bond calculation"].some(k => t.includes(k))) return "label-red-light";
  // Normal Red
  if (["forensic audit"].some(k => t.includes(k))) return "label-red-norm";
  // Dark Red
  if (["ryangpt", "ryan gpt", "waiting payment"].some(k => t.includes(k))) return "label-red-dark";

  // --- PURPLE ---
  // Light Purple
  if (["broken contract", "building model"].some(k => t.includes(k))) return "label-purple-light";
  // Normal Purple
  if (["other"].some(k => t === "other" || t.includes("other -"))) return "label-purple-norm";
  // Dark Purple
  if (["deceased estate"].some(k => t.includes(k))) return "label-purple-dark";

  // --- BLUE (Extra ones from your previous list if needed) ---
  if (["non-raf los", "share valuation", "farm", "joint actuarial", "professional negligence", "wrongful", "divorce", "accrual", "commercial", "ip los", "general damages", "interest"].some(k => t.includes(k))) return "label-blue-norm";

  return "label-default";
}

function ensureBadgeTypes(badges = []) {
  return (badges || []).map(b => {
    const t = b?.text || "";
    
    // 1. Status / Active (Bottom Row)
    if (/^Active\s*:/i.test(t)) {
      const val = t.replace(/^Active\s*:\s*/i, "");
      return { ...b, type: b.type || activeTypeFromText(val), isBottom: true };
    }
    if (/^Status\s*:/i.test(t)) {
      const val = t.replace(/^Status\s*:\s*/i, "");
      return { ...b, type: b.type || statusTypeFromText(val), isBottom: true };
    }
    
    // 2. Priority (MOVED TO BOTTOM ROW) 
    if (/^Priority\s*:/i.test(t)) {
      const val = t.replace(/^Priority\s*:\s*/i, "");
      // 👇 Changed isTop -> isBottom
      return { ...b, type: b.type || priorityTypeFromText(val), isBottom: true }; 
    }

    // 3. Standard Labels (Top Row) - Assign colors dynamically
    return { ...b, type: b.type || getLabelColor(t), isTop: true };
  });
}

// 👇 NEW HELPER: Match card titles to Trello Cover Colors
function getTrelloCoverColor(title) {
  const t = String(title || "").toLowerCase();
  if (t.includes("out of office")) return "#6CC3E0";  // 👈 CHANGED: Light Blue (Sky)
  if (t.includes("training - analyst")) return "#579dff"; // Trello Blue
  if (t.includes("innovation gold")) return "#faa53d"; // Trello Orange/Gold
  return null;
}

const RightPanel = React.memo(function RightPanel() {
  const [preview, setPreview] = React.useState(null);
  const [trelloBuckets, setTrelloBuckets] = useState([]);
  const [clientFiles, setClientFiles] = useState([]);

  // --- DRAG AND DROP STATE ---
  const [dragging, setDragging] = useState(false);
  const dragItem = useRef(); // Tracks { grpI, itemI } (Group Index, Item Index)
  const dragNode = useRef(); // Tracks the actual HTML element
  const lastMoveTime = useRef(0); // 👈 ADD THIS
  const hasSnapshotRef = useRef(false);

  // 👇 ADD THIS: Initialize with your default order
  const listOrderRef = useRef(
    PERSONA.toUpperCase() === "SIYA"
      ? ["Siya - Review", "Siya", "Bonolo S", "Bonisa", "Songeziwe", "Enock"]
      : ["Yolandie to Data Capture", "Yolandie to Analyst", "Yolandie to Data Analyst", "Yolandie to Reviewer", "Yolandie to Send"]
  );

  // --- LIST REORDERING LOGIC ---

  const handleListDragStart = (e, index) => {
    e.stopPropagation(); // Don't trigger card drags
    dragItem.current = { listIdx: index };
    dragNode.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';

    // 👇 THIS FIXES THE PREVIEW
    // Set the drag image to the entire Column (parent of the header), not just the Header
    if (e.currentTarget.parentElement) {
        e.dataTransfer.setDragImage(e.currentTarget.parentElement, 20, 20);
    }

    setDragging(true);
  };

  const handleListDragEnter = (e, index) => {
    // 1. Only run if we are dragging a LIST (not a card)
    if (!dragItem.current || dragItem.current.listIdx === undefined) return;
    
    // 2. Don't swap if we are hovering the same list
    if (dragItem.current.listIdx === index) return;

    setTrelloBuckets(prev => {
      const newList = [...prev];
      // Move the list in the array
      const item = newList.splice(dragItem.current.listIdx, 1)[0];
      newList.splice(index, 0, item);
      
      // 🛑 CRITICAL: Update the Ref so the next Trello Poll respects this order!
      listOrderRef.current = newList.map(b => b.title);
      
      return newList;
    });

    // Update tracker
    dragItem.current.listIdx = index;
  };

  // 1. Start Dragging (Overlay Strategy)
  const handleDragStart = (e, params) => {
    dragItem.current = params;
    dragNode.current = e.currentTarget;

    const rect = dragNode.current.getBoundingClientRect();
    const ghost = dragNode.current.cloneNode(true);
    
    // Force Styles
    Object.assign(ghost.style, {
        position: "fixed", top: `${rect.top}px`, left: `${rect.left}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
        zIndex: "9999", pointerEvents: "none", transition: "none",
        transform: "rotate(5deg)", opacity: "1", background: "#fff",
        boxShadow: "0 15px 30px rgba(0,0,0,0.3)" 
    });

    document.body.appendChild(ghost);
    void ghost.offsetWidth; // Force Reflow
    e.dataTransfer.setDragImage(ghost, 20, 20);

    setTimeout(() => {
        if (document.body.contains(ghost)) document.body.removeChild(ghost);
        setDragging(true); 
    }, 0);
  };

  const handleColumnDragEnter = (grpI) => {
    // ✅ SAFETY CHECK: If dragging a LIST, stop immediately.
    if (dragItem.current?.listIdx !== undefined) return;

    // If not dragging, or if we are already in this bucket, do nothing
    if (!dragItem.current || dragItem.current.grpI === undefined || dragItem.current.grpI === grpI) return;

    setTrelloBuckets((oldBuckets) => {
      let newBuckets = JSON.parse(JSON.stringify(oldBuckets));

      const dragGrpIdx = dragItem.current.grpI;
      const dragItemIdx = dragItem.current.itemI;
      
      // Safety: Ensure source bucket exists
      if (!newBuckets[dragGrpIdx]) return oldBuckets;

      const cardToMove = newBuckets[dragGrpIdx].cards[dragItemIdx];
      if (!cardToMove) return newBuckets;

      // ... rest of code (Move the card)
      newBuckets[dragGrpIdx].cards.splice(dragItemIdx, 1);
      newBuckets[grpI].cards.push(cardToMove);
      dragItem.current = { grpI, itemI: newBuckets[grpI].cards.length - 1 };

      return newBuckets;
    });
  };

  // 2. Drag Enter (The "Make Space" Logic)
  const handleDragEnter = (e, params) => {
    // If not dragging or hovering over the same card, do nothing
    if (
        !dragItem.current || 
        (dragItem.current.grpI === params.grpI && dragItem.current.itemI === params.itemI)
    ) return;

    // Deep copy the buckets to mutate them
    setTrelloBuckets(oldBuckets => {
        let newBuckets = JSON.parse(JSON.stringify(oldBuckets));
        
        // Get the card being dragged
        const dragGrpIdx = dragItem.current.grpI;
        const dragItemIdx = dragItem.current.itemI;
        const cardToMove = newBuckets[dragGrpIdx].cards[dragItemIdx];

        // Remove from old spot
        newBuckets[dragGrpIdx].cards.splice(dragItemIdx, 1);
        
        // Insert into new spot
        const targetGrpIdx = params.grpI;
        const targetItemIdx = params.itemI;
        newBuckets[targetGrpIdx].cards.splice(targetItemIdx, 0, cardToMove);

        // IMPORTANT: Update our Ref so we know where the item is NOW
        dragItem.current = params;
        
        return newBuckets;
    });
  };

  // 3. End Dragging (Safe Version)
  const handleDragEnd = async () => {
    // If we already cleaned up, stop.
    if (!dragItem.current) return;

    setDragging(false);
    
    // Clean up CSS
    if (dragNode.current) {
        dragNode.current.style.transform = "";
        dragNode.current.style.opacity = "";
    }

    lastMoveTime.current = Date.now(); 

    const { grpI, itemI } = dragItem.current;
    const destList = trelloBuckets[grpI];
    const card = destList.cards[itemI];
    
    if (destList && card) {
        console.log(`Moving card to List: ${destList.title}, Index: ${itemI}`);
        
        fetch("/.netlify/functions/trello-move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                cardId: card.id, 
                targetListId: destList.id,
                newIndex: itemI 
            }),
        }).catch(e => console.error("Move failed", e));
    }

    // Clear refs immediately so we don't fire twice
    dragItem.current = null;
    dragNode.current = null;
  };

  // 4. Style Helper
  const getStyles = (grpI, itemI) => {
      // Only show placeholder if we are ACTIVELY dragging
      if (dragging && dragItem.current?.grpI === grpI && dragItem.current?.itemI === itemI) {
          return "tl-card dnd-placeholder"; 
      }
      return "tl-card";
  };

  /* ... (Keep your existing Helpers: patchCardInBuckets, refs, useEffects) ... */
  // NOTE: For brevity, I am hiding the helper functions I didn't change (like onSetClientFiles). 
  // ensure you KEEP them in your file. 
  
  // (Paste your existing useEffects here: setClientFiles, openEmailAttachmentPreview, fetchTrello, bucketsUpdated)
  // ... [PASTE YOUR EXISTING USE EFFECTS HERE] ...

  // To save space, I will jump to the return statement where the DRAG EVENTS are attached.

  // --- BULLETPROOF TRELLO POLLING (Anti-429) ---
  useEffect(() => {
    let isMounted = true;
    let pollTimer = null;

    async function fetchTrello(force = false) {
      if (!isMounted) return;

      // 1. SAFETY CHECKS
      if (document.hidden && !force) return; 
      if (dragging && !force) return;
      if (Date.now() - lastMoveTime.current < 2000 && !force) return;

      // 2. RATE LIMITING (The "Mutex")
      const now = Date.now();
      const lastFetch = parseInt(localStorage.getItem("lastTrelloFetch") || "0");
      
      // If fetched < 8 seconds ago, SKIP (unless forced)
      if (!force && (now - lastFetch < 8000)) return;

      // 3. LOCK & FETCH
      localStorage.setItem("lastTrelloFetch", now.toString());

      try {
        const res = await fetch(`/.netlify/functions/trello?t=${now}`);
        
        // Handle 429 specifically
        if (!res.ok) {
           if (res.status === 429) console.warn("Trello Rate Limit Hit - Cooling down...");
           return;
        }

        let json = await res.json();
        
        // Double check move time
        if (Date.now() - lastMoveTime.current < 2000 && !force) return;
        if (!isMounted) return;

        // --- YOUR ORIGINAL DATA PROCESSING LOGIC ---
        let rawBuckets = Array.isArray(json?.buckets) ? json.buckets : (Array.isArray(json) ? json : []);

        // 1. DEFINE TEAM DATA
        const TEAM_DATA = [
          { id: "list-siya-review", title: "Siya - Review", cards: [] },
          { id: "list-siya", title: "Siya", cards: [] },
          { id: "list-bonolo", title: "Bonolo S", cards: [] },
          { id: "list-bonisa", title: "Bonisa", cards: [] },
          { id: "list-songeziwe", title: "Songeziwe", cards: [] },
          { id: "list-enock", title: "Enock", cards: [] }
        ];

        // 2. ROBUST MERGE
        TEAM_DATA.forEach(teamList => {
          const existingIndex = rawBuckets.findIndex(b => {
             const apiTitle = (b.title || b.name || b.list || "").trim().toLowerCase();
             const myTitle  = teamList.title.trim().toLowerCase();
             return apiTitle === myTitle;
          });

          if (existingIndex === -1) {
            rawBuckets.push(teamList);
          } else {
            const existingBucket = rawBuckets[existingIndex];
            // Clean cards
            const realCards = existingBucket.cards || [];
            rawBuckets[existingIndex] = { ...existingBucket, cards: realCards };
          }
        });

        // 3. MAP FIELDS
        let mapped = rawBuckets.map((b) => {
          const title = b.title || b.name || b.list || "";
          return {
            id: b.id,
            title,
            cards: (b.cards || []).map((c) => ({
              id: c.id,
              title: c.name || c.title,
              due: c.due || "",
              badges: ensureBadgeTypes(Array.isArray(c.badges) ? c.badges : []),
              labels: c.labels || [], 
              people: c.idMembers || c.people || [],
              listId: b.id,
              list: title,
              customFields: c.customFields || {},
              description: c.desc || c.description || "",
              cover: c.cover || null
            })),
          };
        });

        // 4. PERSONA FILTER
        let persona = (import.meta.env.VITE_PERSONA || "").toLowerCase().trim();
        if (!persona || persona === "unknown") persona = "siya"; 

        const PERSONA_TITLES = persona === "siya"
            ? ["Siya - Review", "Siya", "Bonolo S", "Bonisa", "Songeziwe", "Enock"]
            : ["Yolandie to Data Capture", "Yolandie to Analyst", "Yolandie to Data Analyst", "Yolandie to Reviewer", "Yolandie to Send"];

        let filtered = mapped.filter((b) => PERSONA_TITLES.includes(b.title));
        
        // 5. SORT LOGIC
        filtered.sort((a, b) => {
          let idxA = listOrderRef.current.indexOf(a.title);
          let idxB = listOrderRef.current.indexOf(b.title);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });

        if (filtered.length > 0) mapped = filtered;

        // --- END USER LOGIC ---

        // Only update if data changed (Simple check)
        setTrelloBuckets(prev => {
            if (JSON.stringify(prev) === JSON.stringify(mapped)) return prev;
            hasSnapshotRef.current = true;
            
            // Broadcast the fresh data to the main App for the Middle Pane to use!
            window.dispatchEvent(new CustomEvent("trelloPolled", { detail: mapped }));
            
            return mapped;
        });

      } catch (err) {
        console.error("Trello Poll Error:", err);
      }
    }

    // Initial Fetch
    fetchTrello();

    // Poll every 12 seconds (Safe zone for Trello API)
    pollTimer = setInterval(() => fetchTrello(), 12000);

    return () => {
        isMounted = false; 
        clearInterval(pollTimer);
    };
  }, [dragging]);

  // ... (keep allow patch buckets logic) ...
  // --- LISTEN FOR INSTANT UPDATES (Fixes Right Pane Delay) ---
  useEffect(() => {
    function handlePatch(e) {
      const { cardId, updater } = e.detail;
      setTrelloBuckets(prevBuckets => {
        // Deep clone to avoid mutation reference issues
        const newBuckets = prevBuckets.map(b => ({
          ...b,
          cards: b.cards.map(c => {
            if (c.id !== cardId) return c;
            
            // Apply the update (e.g., change Priority)
            const updatedCard = updater(c);
            
            // Re-calculate badges for the Right Panel view immediately
            const newBadges = [];
            
            // 1. Priority
            if (updatedCard.customFields?.Priority) {
               newBadges.push({ text: `Priority: ${updatedCard.customFields.Priority}`, isBottom: true });
            }
            // 2. Status
            if (updatedCard.customFields?.Status) {
               newBadges.push({ text: `Status: ${updatedCard.customFields.Status}`, isBottom: true });
            }
            // 3. Active
            if (updatedCard.customFields?.Active) {
               newBadges.push({ text: `Active: ${updatedCard.customFields.Active}`, isBottom: true });
            }
            
            // Preserve labels
            updatedCard.labels.forEach(l => newBadges.push({ text: l, isBottom: false }));
            
            updatedCard.badges = ensureBadgeTypes(newBadges);
            return updatedCard;
          })
        }));
        return newBuckets;
      });
    }

    window.addEventListener("patchCardInBuckets", handlePatch);
    return () => window.removeEventListener("patchCardInBuckets", handlePatch);
  }, []);

  // Map clientFiles -> UI files (unchanged)
  const files = (clientFiles || []).map((f, i) => {
    let type = f.type || "other";
    if (!f.type && f.mimeType) {
      if (f.mimeType === "application/pdf") type = "pdf";
      else if (f.mimeType.startsWith("image/")) type = "img";
      else if (f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || f.mimeType === "application/vnd.ms-excel") type = "xls";
    }
    const url = f.url || (f.id ? `/.netlify/functions/drive-download?id=${encodeURIComponent(f.id)}` : "#");
    const thumbUrl = f.thumbUrl || url;
    return { id: f.id || `att-${i}`, name: f.name || `Attachment ${i + 1}`, type, url, thumbUrl };
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
            <div 
                className="tl-col" 
                key={bucket.id || i}
                // 1. Mandatory for dropping
                onDragOver={(e) => e.preventDefault()} 
                // 2. INTELLIGENT ROUTING: List Swap vs Card Move
                onDragEnter={(e) => {
                    e.preventDefault();
                    if (dragging) {
                        // If dragging a LIST -> Reorder Lists
                        if (dragItem.current?.listIdx !== undefined) handleListDragEnter(e, i);
                        // If dragging a CARD -> Move Card to this List
                        else handleColumnDragEnter(i);
                    }
                }}
                // 3. Drop Handler
                onDrop={(e) => {
                    e.preventDefault();
                    // Save Card Move
                    if (dragItem.current?.grpI !== undefined) handleDragEnd();
                    // Finish List Move
                    if (dragItem.current?.listIdx !== undefined) setDragging(false);
                }}
            >
              {/* HEADER (Draggable) */}
              <div 
                className="tl-head"
                draggable
                onDragStart={(e) => handleListDragStart(e, i)}
                style={{ cursor: "grab" }} 
              >
                <span className="tl-title">{bucket.title}</span>
                <span className="tl-actions">•••</span>
              </div>
              
              {/* CARDS */}
              <div className="tl-cards">
                {bucket.cards.map((card, j) => (
                  <div
                    key={card.id || j}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { grpI: i, itemI: j })}
                    onDragEnter={dragging ? (e) => handleDragEnter(e, { grpI: i, itemI: j }) : null}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className={getStyles(i, j)}
                    onClick={() => window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: card }))}
                  >
                     {/* ... (Your Card Content - Colors, Badges, Title, Footer) ... */}
                     {/* Copy your existing card inner content here if needed, or leave it as is */}
                     
                     {/* RE-INSERTING YOUR CARD CONTENT FOR CLARITY: */}
                     {(() => {
                      const coverColor = card.cover?.color;
                      const titleColor = getTrelloCoverColor(card.title);
                      const colorMap = { sky: "#6CC3E0", orange: "#FAA53D", blue: "#579DFF", green: "#4BCE97", yellow: "#F5CD47", red: "#F87168", purple: "#9F8FEF" };
                      const finalColor = titleColor || colorMap[coverColor];
                      if (finalColor) return ( <div className="tl-card-cover" style={{ backgroundColor: finalColor }} /> );
                      return null;
                    })()}

                    {(() => {
                      const labelBadges = (card.labels || []).map(l => ({ text: l, type: getLabelColor(l), isTop: true }));
                      const labelTexts = new Set(labelBadges.map(b => (b.text || "").toLowerCase().trim()));
                      const uniqueCardBadges = (card.badges || []).filter(b => !labelTexts.has((b.text || "").toLowerCase().trim()));
                      const allBadges = [...labelBadges, ...uniqueCardBadges];
                      const topBadges = allBadges.filter(b => b.isTop);
                      const bottomBadges = allBadges.filter(b => b.isBottom);
                      
                      return (
                        <>
                          {topBadges.length > 0 && <div className="tl-badges">{topBadges.map((b, k) => <span key={k} className={`tl-badge ${b.type || "label-default"}`}>{b.text}</span>)}</div>}
                          <div className="tl-card-title">{card.title}</div>
                          {bottomBadges.length > 0 && <div className="tl-badges" style={{marginTop:"6px", flexDirection:"column", alignItems:"flex-start", gap:"4px"}}>{bottomBadges.map((b, k) => <span key={k} className={`tl-badge ${b.type || "label-default"}`}>{b.text}</span>)}</div>}
                        </>
                      );
                    })()}

                    {(card.description || card.due || (card.people && card.people.length > 0)) && (
                        <div className="tl-footer">
                          <div className="tl-icons">
                            {card.description && <span>≡</span>} 
                            {card.due && <span>🕒</span>}
                          </div>
                          <div className="tl-people">
                            {card.people?.map((p, idx) => {
                              const img = avatarFor(p);
                              return img ? <img key={idx} className="av-img" src={img} alt={p} /> : <div key={idx} className="av">{p.slice(0,1)}</div>;
                            })}
                          </div>
                        </div>
                    )}
                  </div>
                ))}
              </div>

              <button className="tl-add"><span>+</span> Add a card</button>
            </div>
          ))}
        </div>

        <div className="panel-title" style={{ marginTop: "0.75rem" }}>Client Files</div>
        <div className="doc-grid">
           {files.map((f) => (
            <button key={f.id} className={`doc-card ${f.type}`} onClick={() => window.dispatchEvent(new CustomEvent("openEmailAttachmentPreview", { detail: { file: f } }))} title={f.name}>
              <div className="doc-preview">
                {isImage(f.type) ? <img src={f.thumbUrl || f.url} alt={f.name} /> : isPdf(f.type) ? <iframe title={f.name} src={f.url} className="pdf-frame" /> : isExcel(f.type) ? <div className="doc-icon">XLS</div> : <div className="doc-icon">FILE</div>}
              </div>
              <div className="doc-info">
                <span className={`doc-badge ${f.type}`}>{f.type === "xls" ? "XLSX" : f.type.toUpperCase()}</span>
                <span className="doc-name">{f.name}</span>
              </div>
              <span className="doc-corner" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// 👇 NEW: Text Formatter for GChat (Bolding + Links + Newlines)
function formatChatText(text) {
  if (!text) return "";
  
  // 1. Split by newlines, URLs, and *bold* markers
  // Regex captures: (\n) OR (http...) OR (*bold*)
  const parts = text.split(/(\n|https?:\/\/[^\s]+|\*[^*]+\*)/g);

  return parts.map((part, i) => {
    // A. Handle Newlines
    if (part === "\n") return <br key={i} />;
    
    // B. Handle URLs
    if (part.match(/^https?:\/\//)) {
      return (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ color: "#1a73e8", textDecoration: "underline", wordBreak: "break-all" }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    // C. Handle *Bold*
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }

    // D. Plain Text
    return part;
  });
}

/* ---------- app ---------- */
export default function App() {
  const [inputValue, setInputValue] = useState("");
  const [notifications, setNotifications] = useState([]);
  // 👇 NEW state for the label picker
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const nextIdRef = useRef(0);
  const rotateIdxRef = useRef(0);
  const emailRotateRef = useRef(0);
  const chatTextareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const seenGmailIdsRef = useRef(null); // 👇 NEW: Track seen Gmail IDs to avoid spamming notifications
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  /* Google Chat */

  /* Google Chat */
  const gchatBodyRef = useRef(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  // 👇 CHANGED: Use Ref instead of State for instant typing
  const newChatEmailRef = useRef(null);

  // 👇 NEW: Track last active space for background polling
  const lastActiveSpaceRef = useRef(null);

  const [gchatSpaces, setGchatSpaces] = useState([]);
  const [gchatLoading, setGchatLoading] = useState(false);
  const [gchatError, setGchatError] = useState("");
  const [gchatSelectedSpace, setGchatSelectedSpace] = useState(null);

  const [gchatMessages, setGchatMessages] = useState([]);
  const [gchatMe, setGchatMe] = useState(null);
  const [gchatMsgLoading, setGchatMsgLoading] = useState(false);
  const [gchatMsgError, setGchatMsgError] = useState("");
  const [gchatComposer, setGchatComposer] = useState("");
  const [gchatDmNames, setGchatDmNames] = useState({});
  const [gchatAutoScroll, setGchatAutoScroll] = useState(true);
  const [pendingUpload, setPendingUpload] = useState(null); // { file: File, kind: "pdf" }
  const [trelloBuckets, setTrelloBuckets] = useState([]); // <--- ADD THIS LINE BACK
  // Add this near your other state variables
  const [timerNow, setTimerNow] = useState(Date.now());
  // 👇 NEW: States for the "Add Time" popup
  const [showAddTime, setShowAddTime] = useState(false);
  const [manualHours, setManualHours] = useState("0");
  const [manualMins, setManualMins] = useState("0");

  // Update the timer every second for visual feedback
  useEffect(() => {
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 👇 UPDATED: Persist last active space so notifications work after reload
  useEffect(() => {
    if (gchatSelectedSpace) {
      lastActiveSpaceRef.current = gchatSelectedSpace;
      localStorage.setItem("LAST_ACTIVE_SPACE_ID", gchatSelectedSpace.id);
    }
  }, [gchatSelectedSpace]);

  // 👇 NEW: Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 👇 NEW: Persist last notification time across re-renders
  const lastNotifiedRef = useRef({ time: Date.now() });

  /* 🔴 NEW — Google Chat reactions UI state */

  /* 🔴 NEW — Google Chat reactions UI state */
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [reactions, setReactions] = useState({});
  const [gchatFilePreview, setGchatFilePreview] = useState(null); // { url, name, type }


function toggleReaction(messageId, type) {
    // 1. Optimistic UI Update (Instant visual feedback)
    setReactions((prev) => {
      const currentList = prev[messageId] || [];
      const isSame = currentList.includes(type);
      const next = isSame ? [] : [type]; // "Override" logic
      return { ...prev, [messageId]: next };
    });

    // 2. Send to Google (Background API Call)
    // Note: We only support ADDING for now. 
    fetch("/.netlify/functions/gchat-react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, type })
    }).catch(err => console.error("Reaction failed", err));
  }

useEffect(() => {
    const saved = localStorage.getItem("GCHAT_ME");
    if (saved) setGchatMe(saved);
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (e.target.closest?.(".chat-plus-wrap")) return;
      setShowPlusMenu(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // ✅ put scroll effect AFTER the above state exists
  useEffect(() => {
    const el = gchatBodyRef.current;
    if (!el) return;
    if (!gchatAutoScroll) return;

    el.scrollTop = el.scrollHeight;
  }, [gchatMessages, gchatSelectedSpace?.id, gchatAutoScroll]);

  const [currentView, setCurrentView] = useState({ app: "none", contact: null });

  const seenDriveEmailIdsRef = useRef(new Set());

  /* WhatsApp */
  const [waChats, setWaChats] = useState(() => buildSeedChats());
  const waBodyRef = useRef(null);

  /* Email */
 /* Email */
  const [emailIdx, setEmailIdx] = useState(0);
  const [email, setEmail] = useState(EMAIL_THREADS[0]);
  const [emailPreview, setEmailPreview] = useState(null);

  /* Gmail Inbox State */
  const [gmailEmails, setGmailEmails] = useState([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState("");


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
  const nice =
    PERSONA.toUpperCase() === "YOLANDIE"
      ? "Yolandie"
      : PERSONA.toUpperCase() === "SIYA"
      ? "Siya"
      : "Unknown";

  document.title = `ActuarySpace — ${nice}`;
  }, []);

  // src/App.jsx

  useEffect(() => {
    const onNotify = (e) => {
      // 👇 CHANGED: Destructure icon, alt, spaceId too
      const { text, cardId, icon, alt, spaceId, driveEmail } = e.detail || {};
      
      if (!text) return;

      const unique = `${cardId || spaceId || "noid"}-${nextIdRef.current++}`;
      
      const item = {
        id: `nt-${unique}`,
        // 👇 CHANGED: Use passed values or fallback to Trello defaults
        alt: alt || "Trello",
        icon: icon || trelloIcon,
        text,
        time: formatUKTimeWithSeconds(new Date()),
        cardId,
        spaceId,     // For Google Chat
        driveEmail,  // For Gmail
      };
      
      setNotifications((prev) => [item, ...prev].slice(0, 200));
    };
    
    window.addEventListener("notify", onNotify);
    return () => window.removeEventListener("notify", onNotify);
  }, []);

  // 1. GLOBAL IDENTITY LOADER (Runs once on mount, regardless of view)
  useEffect(() => {
    async function fetchWhoAmI() {
      // Try local storage first to be fast
      const stored = localStorage.getItem("GCHAT_ME");
      if (stored) setGchatMe(stored);

      try {
        const res = await fetch("/.netlify/functions/gchat-whoami");
        const json = await res.json().catch(() => ({}));
        const myId = json.name || json.user?.name || json.resourceName;

        if (myId) {
          console.log("identified current user as:", myId);
          setGchatMe(myId);
          localStorage.setItem("GCHAT_ME", myId);
        }
      } catch (err) {
        console.error("Failed to identify current user:", err);
      }
    }
    fetchWhoAmI();
  }, []);

  // 1.5 SPACE LOADER (Fetches the list of rooms/DMs)
  useEffect(() => {
    if (currentView.app !== "gchat") return;

    let cancelled = false;

    async function loadSpaces() {
      try {
        setGchatLoading(true);
        setGchatError("");

        const res = await fetch("/.netlify/functions/gchat-spaces");
        const json = await res.json().catch(() => ({}));

        if (!res.ok || json.ok !== true) {
          throw new Error(json?.error || `Failed to load spaces (HTTP ${res.status})`);
        }

        if (!cancelled) {
          // This populates the list so the next useEffect can name them
          setGchatSpaces(Array.isArray(json.spaces) ? json.spaces : []);
          setGchatSelectedSpace(null);
          setGchatMessages([]);
          setGchatMsgError("");
          setGchatComposer("");
        }
      } catch (err) {
        if (!cancelled) setGchatError(String(err?.message || err));
      } finally {
        if (!cancelled) setGchatLoading(false);
      }
    }

    loadSpaces();

    return () => {
      cancelled = true;
    };
  }, [currentView.app]);

// 2. CHAT VIEW LOADER (Runs only when opening Chat)
  useEffect(() => {
    if (currentView.app !== "gchat") return;
    if (!gchatSpaces.length) return;

    // 1. Find all DMs that are Unnamed OR explicitly called "Direct Message"
    const dmsToLoad = gchatSpaces.filter(
      (s) => 
        s.type === "DIRECT_MESSAGE" && 
        (!gchatDmNames[s.id] || gchatDmNames[s.id] === "Direct Message") // 👈 THIS IS THE CRITICAL FIX
    );

    if (!dmsToLoad.length) return;

    // 2. Fire ALL requests in parallel (The "Blast")
    Promise.all(
      dmsToLoad.map(async (dm) => {
        try {
          const res = await fetch(
            `/.netlify/functions/gchat-dm-name?space=${encodeURIComponent(dm.id)}`
          );
          
          if (!res.ok) return;

          const json = await res.json().catch(() => ({}));

          // 3. Incrementally update state as each one lands (Instant Pop-in)
          if (json.ok && json.names) {
            const label = Object.values(json.names)[0];
            // Only update if we got a REAL name (not "Direct Message" again)
            if (label && label !== "Direct Message") {
              setGchatDmNames((prev) => ({
                ...prev,
                [dm.id]: label,
              }));
            }
          }
        } catch (err) {
          console.error("DM name resolution failed for", dm.id, err);
        }
      })
    );
  }, [currentView.app, gchatSpaces]);

  // 3. NAME LEARNER (The Fix for Sidebar Mismatch)
  // Watches the active chat. If the header finds a real name, force-update the sidebar list.
  useEffect(() => {
    if (!gchatSelectedSpace || !gchatMessages.length) return;
    if (gchatSelectedSpace.type !== "DIRECT_MESSAGE") return;

    // 1. Get the name we currently have in the list
    const currentListName = gchatDmNames[gchatSelectedSpace.id];

    // 2. Find the REAL name from the messages (Enock, etc.)
    const otherMsg = gchatMessages.find(m => {
      const senderId = m.sender?.name || "";
      // Ignore myself
      return senderId && senderId !== gchatMe; 
    });
    
    const realName = otherMsg?.sender?.displayName;

    // 3. If the List says "Direct Message" but the Chat knows "Enock", FIX IT.
    if (realName && currentListName !== realName) {
      console.log("🧠 Learning Name:", gchatSelectedSpace.id, "->", realName);
      
      setGchatDmNames(prev => {
        const next = { ...prev, [gchatSelectedSpace.id]: realName };
        // Save to storage so it persists on refresh
        localStorage.setItem("GCHAT_DM_NAMES", JSON.stringify(next));
        return next;
      });
    }
  }, [gchatSelectedSpace, gchatMessages, gchatMe, gchatDmNames]);

  // Google Chat: load + poll messages when a space is selected
useEffect(() => {
  if (currentView.app !== "gchat") return;
  if (!gchatSelectedSpace?.id) return;

  let cancelled = false;

  async function fetchLatestAndMerge() {
    try {
      setGchatMsgError("");

      const res = await fetch(
        `/.netlify/functions/gchat-messages?space=${encodeURIComponent(
          gchatSelectedSpace.id
        )}`
      );
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok !== true) {
        throw new Error(
          json?.error || `Failed to load messages (HTTP ${res.status})`
        );
      }

      const incomingRaw = Array.isArray(json.messages) ? json.messages : [];
      const incoming = incomingRaw.map((m) => normalizeGChatMessage(m));

        if (!cancelled) {
        // 👇 CLEANED: Just update the UI, no notifications here
        setGchatMessages((prev) => dedupeMergeMessages(prev, incoming));

        // 👇 NEW: Sync Reactions from History (Server -> Website)
        setReactions((prev) => {
          const next = { ...prev };
          incoming.forEach((msg) => {
            // If the message has reactions from the server, store them
            if (msg.reactions && Array.isArray(msg.reactions)) {
              // We overwrite local state with server truth
              next[msg.id || msg.name] = msg.reactions;
            }
          });
          return next;
        });
      }
    } catch (err) {
      if (!cancelled) setGchatMsgError(String(err?.message || err));
    }
  }

  // reset thread for the newly selected space + do initial load
  setGchatMessages([]);
  setGchatMsgLoading(true);

  fetchLatestAndMerge().finally(() => {
    if (!cancelled) setGchatMsgLoading(false);
  });

  // poll every 4 seconds (tune if you want)
    const pollId = setInterval(fetchLatestAndMerge, 4000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [currentView.app, gchatSelectedSpace?.id]);

  // 👇 NEW: Global Background Poller (Production Version)
  // 👇 NEW: Global Background Poller (Smart Relative Version)
  useEffect(() => {
    // We use a ref to track the Last Message ID we have seen in the background
    const lastSeenMsgIdRef = { current: null };

    const pollGlobal = async () => {
      let targetSpaceId = lastActiveSpaceRef.current?.id || localStorage.getItem("LAST_ACTIVE_SPACE_ID");

      // Auto-Discovery (Keep this, it's good)
      if (!targetSpaceId) {
        try {
          const res = await fetch("/.netlify/functions/gchat-spaces");
          const json = await res.json().catch(() => ({}));
          if (json.ok && json.spaces?.length > 0) {
            targetSpaceId = json.spaces[0].name;
            localStorage.setItem("LAST_ACTIVE_SPACE_ID", targetSpaceId);
            console.log("✅ [Background] Auto-selected:", json.spaces[0].displayName);
          }
        } catch (e) {}
      }

      if (!targetSpaceId) return;

      // Stop if watching
      const amIWatching = currentView.app === "gchat" && gchatSelectedSpace?.id === targetSpaceId;
      if (amIWatching) {
        // If we are watching, reset our tracker so we pick up fresh when we leave
        lastSeenMsgIdRef.current = null;
        return;
      }

      try {
        const res = await fetch(
          `/.netlify/functions/gchat-messages?space=${encodeURIComponent(targetSpaceId)}`
        );
        const json = await res.json().catch(() => ({}));
        
        if (!json.ok || !Array.isArray(json.messages) || json.messages.length === 0) return;

        const msgs = json.messages.map(normalizeGChatMessage);
        const latestMsg = msgs[msgs.length - 1]; // The newest message on server
        const latestId = latestMsg.name || latestMsg.id;

        // 1. First Run: Just memorize the ID (don't notify about history)
        if (!lastSeenMsgIdRef.current) {
           lastSeenMsgIdRef.current = latestId;
           return;
        }

        // 2. Subsequent Runs: If ID changed, it's a NEW message
        if (latestId !== lastSeenMsgIdRef.current) {
           lastSeenMsgIdRef.current = latestId; // Update tracker

           // Notify if not me
           if (latestMsg.sender?.name !== gchatMe) {
             console.log("🔔 [Background] Notification:", latestMsg.text);
             
             const sender = latestMsg.sender?.displayName || "Colleague";
             let preview = latestMsg.text || "";
             if (!preview && latestMsg.attachment?.length) preview = "Sent a file";

             window.dispatchEvent(new CustomEvent("notify", {
                detail: {
                  text: `${sender}: ${preview}`,
                  alt: "Google Chat",
                  icon: gchatIcon,
                  spaceId: targetSpaceId
                }
             }));
           }
        }
      } catch (err) {
        console.error("Background poll error", err);
      }
    };

    // Run every 4 seconds
    const intervalId = setInterval(pollGlobal, 4000);
    return () => clearInterval(intervalId);
  }, [currentView.app, gchatSelectedSpace, gchatMe]);

  // 🔔 Poll Data Centre (Google Drive) for new instruction emails
  // 👇 NEW: Background Poller (Notifies you when on Trello/Gmail)
  useEffect(() => {
    const pollBackground = async () => {
      // 1. Only run if we are NOT in GChat (GChat has its own real-time poller)
      //    and we have a space to check.
      if (currentView.app === "gchat") return;
      
      const targetSpace = lastActiveSpaceRef.current;
      if (!targetSpace) return;

      try {
        const res = await fetch(
          `/.netlify/functions/gchat-messages?space=${encodeURIComponent(targetSpace.id)}`
        );
        const json = await res.json().catch(() => ({}));
        if (!json.ok || !Array.isArray(json.messages)) return;

        // Get the last known message timestamp from our LOCAL state
        const lastMsg = gchatMessages[gchatMessages.length - 1];
        if (!lastMsg) return;

        const serverMessages = json.messages.map(normalizeGChatMessage);
        const lastServerMsg = serverMessages[serverMessages.length - 1];

        // If server has a newer message than what we have in memory
        if (getMsgTs(lastServerMsg) > getMsgTs(lastMsg)) {
          
          // Check who sent it
          if (lastServerMsg.sender?.name !== gchatMe) {
             const sender = lastServerMsg.sender?.displayName || "Someone";
             
             // Handle attachments text
             let previewText = lastServerMsg.text || "";
             if (!previewText && lastServerMsg.attachment && lastServerMsg.attachment.length > 0) {
                 previewText = `Sent an attachment`;
             }
             
             // 🔔 Ding! Notification
             window.dispatchEvent(new CustomEvent("notify", {
                detail: {
                  text: `${sender}: ${previewText}`,
                  alt: "Google Chat",
                  icon: gchatIcon,
                  spaceId: targetSpace.id
                }
             }));

             // Update local state silently so we don't notify again for the same msg
             setGchatMessages((prev) => dedupeMergeMessages(prev, serverMessages));
          }
        }
      } catch (err) {
        console.error("Background poll failed", err);
      }
    };

    const id = setInterval(pollBackground, 5000); // Check every 5s
    return () => clearInterval(id);
  }, [currentView.app, gchatMessages, gchatMe]);

  // 🔔 Poll Data Centre (Google Drive) for new instruction emails
// 📧 GMAIL BACKGROUND POLLER (Real Inbox)
  useEffect(() => {
    const pollGmailBackground = async () => {
      try {
        const res = await fetch("/.netlify/functions/gmail-inbox");
        const json = await res.json().catch(() => ({}));
        
        if (!json.ok || !Array.isArray(json.emails)) return;

        // 1. FIRST RUN: Memorize inbox AND trigger notifications for UNREAD emails
        if (seenGmailIdsRef.current === null) {
          seenGmailIdsRef.current = new Set(json.emails.map(e => e.id));
          
          json.emails.forEach(email => {
            if (email.isUnread) {
              const cleanFrom = email.from ? email.from.split("<")[0].replace(/"/g, '').trim() : "Someone";
              const cleanSubject = email.subject || "(No Subject)";
              window.dispatchEvent(new CustomEvent("notify", {
                detail: {
                  text: `${cleanFrom}: ${cleanSubject}`,
                  alt: "Gmail",
                  icon: gmailIcon,
                  gmailData: email
                }
              }));
            }
          });
          return;
        }

        // 2. SUBSEQUENT RUNS: Check for new emails
        json.emails.forEach(email => {
          if (!seenGmailIdsRef.current.has(email.id)) {
            // Add to seen list so it doesn't trigger twice
            seenGmailIdsRef.current.add(email.id);

            // Clean up sender name
            const cleanFrom = email.from ? email.from.split("<")[0].replace(/"/g, '').trim() : "Someone";
            const cleanSubject = email.subject || "(No Subject)";

            // Dispatch Notification
            window.dispatchEvent(new CustomEvent("notify", {
              detail: {
                text: `${cleanFrom}: ${cleanSubject}`,
                alt: "Gmail",
                icon: gmailIcon,
                gmailData: email // Pass the real email data
              }
            }));

            // Insert it seamlessly if they are actively looking at the Gmail tab
            setGmailEmails(prev => {
              const exists = prev.find(p => p.id === email.id);
              if (exists) return prev;
              return [email, ...prev];
            });
          }
        });
      } catch (err) {
        console.error("Background Gmail poll failed", err);
      }
    };

    pollGmailBackground();
    const id = setInterval(pollGmailBackground, 15000); 
    return () => clearInterval(id);
  }, []);

 // 🔔 Poll Data Centre (Google Drive) for new instruction emails
  useEffect(() => {
    // DISABLED: We are now using the real Gmail API polling below.
    // This stops the raw .eml Drive file IDs from spamming the notifications panel.
  }, [setNotifications]);

  // 📧 GMAIL INBOX LOADER
  useEffect(() => {
    if (currentView.app !== "gmail") return;

    let cancelled = false;
    async function loadInbox() {
      setGmailLoading(true);
      setGmailError("");
      try {
        const res = await fetch("/.netlify/functions/gmail-inbox");
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        if (!cancelled) {
          // Merge server data but lock in our local 'read' state to prevent flickering back to bold
          setGmailEmails(prev => {
            const localReadIds = new Set(prev.filter(e => e.isUnread === false).map(e => e.id));
            return (json.emails || []).map(serverEmail => {
              if (localReadIds.has(serverEmail.id)) return { ...serverEmail, isUnread: false };
              return serverEmail;
            });
          });
        }
      } catch (err) {
        if (!cancelled) setGmailError(String(err.message || err));
      } finally {
        if (!cancelled) setGmailLoading(false);
      }
    }

    loadInbox();
    return () => { cancelled = true; };
  }, [currentView.app]);

 
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
      description: (e.detail.description ?? deriveDescriptionFromTitle(e.detail.title)),
      customFields: e.detail.customFields || {}, /* 👈 CRITICAL: Loads the saved time when tab opens */
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

  // 1. TRACK PENDING UPDATES (Prevents flickering)
  useEffect(() => {
    function onPendingCF(e) {
      const { cardId, field, ttlMs = 2000 } = e.detail || {}; 
      if (!cardId || !field) return;
      const now = Date.now();
      const m = pendingCFRef.current;
      const rec = m.get(cardId) || {};
      rec[field] = now + ttlMs; // Ignore server updates for this field for 2s
      m.set(cardId, rec);
    }
    window.addEventListener("pendingCF", onPendingCF);
    return () => window.removeEventListener("pendingCF", onPendingCF);
  }, []);
  
// CATCH POLLED DATA FROM RIGHT PANEL
  useEffect(() => {
    function handlePoll(e) {
      setTrelloBuckets(e.detail);
    }
    window.addEventListener("trelloPolled", handlePoll);
    return () => window.removeEventListener("trelloPolled", handlePoll);
  }, []);

  // 2. RIGHT PANE: INSTANT UPDATE LISTENER (Fixes 10s delay)
  useEffect(() => {
    function handlePatch(e) {
      const { cardId, updater } = e.detail;
      setTrelloBuckets(prevBuckets => {
        return prevBuckets.map(b => ({
          ...b,
          cards: b.cards.map(c => {
            if (c.id !== cardId) return c;
            
            // Apply the update locally
            const updatedCard = updater(c);
            
            // Re-calculate badges for the Right Panel view immediately
            const newBadges = [];
            
            // Priority
            if (updatedCard.customFields?.Priority) {
               newBadges.push({ text: `Priority: ${updatedCard.customFields.Priority}`, isBottom: true });
            }
            // Status
            if (updatedCard.customFields?.Status) {
               newBadges.push({ text: `Status: ${updatedCard.customFields.Status}`, isBottom: true });
            }
            // Active
            if (updatedCard.customFields?.Active) {
               newBadges.push({ text: `Active: ${updatedCard.customFields.Active}`, isBottom: true });
            }
            
            // Preserve labels
            (updatedCard.labels || []).forEach(l => newBadges.push({ text: l, isBottom: false }));
            
            updatedCard.badges = ensureBadgeTypes(newBadges);
            return updatedCard;
          })
        }));
      });
    }

    window.addEventListener("patchCardInBuckets", handlePatch);
    return () => window.removeEventListener("patchCardInBuckets", handlePatch);
  }, []);

  // 3. MIDDLE PANE: SYNC WITH TRELLO (Fixes "Not Updating")
  useEffect(() => {
    if (!trelloCard?.id) return;

    // A. Find fresh copy of the open card
    let fresh = null;
    for (const b of trelloBuckets) {
      const hit = (b.cards || []).find(x => x.id === trelloCard.id);
      if (hit) { fresh = hit; break; }
    }
    if (!fresh) return;

    // B. Check which fields are "Pending" (edited recently by user)
    const now = Date.now();
    const pend = pendingCFRef.current.get(trelloCard.id) || {};
    const isPending = (field) => pend[field] && pend[field] > now;

    // C. Detect Changes
    const oldCF = JSON.stringify(trelloCard.customFields || {});
    const newCF = JSON.stringify(fresh.customFields || {});
    const oldLabels = JSON.stringify(trelloCard.labels || []);
    const newLabels = JSON.stringify(fresh.labels || []);
    const oldDesc = trelloCard.description || "";
    const newDesc = fresh.description || "";

    // D. Update if changed (BUT respect pending fields)
    if (oldCF !== newCF || oldLabels !== newLabels || oldDesc !== newDesc) {
       console.log("Syncing Middle Pane with Trello changes...");
       setTrelloCard(prev => {
          const mergedCF = { ...fresh.customFields };

          // 🛡️ PROTECT LOCAL EDITS: If user just edited these, ignore Server value for a few seconds
          if (isPending("Priority"))   mergedCF.Priority   = prev.customFields.Priority;
          if (isPending("Status"))     mergedCF.Status     = prev.customFields.Status;
          if (isPending("Active"))     mergedCF.Active     = prev.customFields.Active;
          if (isPending("Duration"))   mergedCF.Duration   = prev.customFields.Duration;
          if (isPending("TimerStart")) mergedCF.TimerStart = prev.customFields.TimerStart;
          if (isPending("WorkDuration"))   mergedCF.WorkDuration   = prev.customFields.WorkDuration;
          if (isPending("WorkTimerStart")) mergedCF.WorkTimerStart = prev.customFields.WorkTimerStart;  

          return {
             ...prev,
             labels: fresh.labels,       // Always take fresh labels
             description: descEditing ? prev.description : newDesc, 
             customFields: mergedCF,     // Smart Merge
             badges: ensureBadgeTypes([
                ...(mergedCF.Priority ? [{text: `Priority: ${mergedCF.Priority}`, isBottom: true}] : []),
                ...(mergedCF.Status   ? [{text: `Status: ${mergedCF.Status}`, isBottom: true}] : []),
                ...(mergedCF.Active   ? [{text: `Active: ${mergedCF.Active}`, isBottom: true}] : []),
                ...(fresh.labels || []).map(l => ({text: l, isBottom: false}))
             ])
          };
       });
    }
  }, [trelloBuckets]);

  const detectContact = (text, fallback) => {
    const hit = AC_CONTACTS.find((n) => text.includes(n));
    return hit || fallback;
  };

 const onNotificationClick = async (n) => {
    // 👇 NEW: Google Chat Handler
    if (n.alt === "Google Chat") {
      // 1. Switch View
      setCurrentView({ app: "gchat", contact: null });

      // 2. Select the Space (if found)
      if (n.spaceId) {
        const targetSpace = gchatSpaces.find((s) => s.id === n.spaceId);
        if (targetSpace) {
          setGchatSelectedSpace(targetSpace);
        }
      }

      // 3. Dismiss notification
      dismissNotification(n);
      return;
    }

    // 📧 Real Gmail Inbox Handler
    if (n.alt === "Gmail" && n.gmailData) {
      setCurrentView({ app: "gmail", contact: null });
      dismissNotification(n);
      return;
    }

  // 📨 Gmail-style notifications from Data Centre (Drive)
  if (n.alt === "Gmail" && n.driveEmail) {
    try {
      // 🔁 UPDATED: fetch attachments scoped to THIS email
      const res = await fetch(
        `/.netlify/functions/drive-get-email-attachments?id=${encodeURIComponent(
          n.driveEmail.id
        )}`
      );
      const json = await res.json().catch(() => ({}));
      const files = Array.isArray(json.files) ? json.files : [];

      const attachments = files.map((f) => {
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
  const dismissNotification = (n) => {
    // If it's a real Gmail notification, mark it as read in the background
    if (n.alt === "Gmail" && n.gmailData?.id) {
      fetch("/.netlify/functions/gmail-mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: n.gmailData.id })
      }).catch(err => console.error("Mark read failed", err));

      // Optimistically update the inbox UI to remove the bold text
      setGmailEmails(prev => prev.map(e => e.id === n.gmailData.id ? { ...e, isUnread: false } : e));
    }

    // Remove from UI (handles both objects and raw IDs just in case)
    const idToRemove = typeof n === "string" ? n : n.id;
    setNotifications((prev) => prev.filter((x) => x.id !== idToRemove));
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

  /* send + auto reply (WhatsApp + Google Chat) */
/* src/App.jsx - Improved handleSend */

// 👇 NEW: Voice Note Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mp3" });
        const audioFile = new File([audioBlob], "voice-note.mp3", { type: "audio/mp3" });
        
        // Reuse existing upload logic
        setPendingUpload({ file: audioFile, kind: "file" });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

const handleStartChat = async () => {
    const targetEmail = newChatEmailRef.current?.value || "";
    if (!targetEmail.trim()) return;
    
    setGchatLoading(true);
    
    try {
      const res = await fetch("/.netlify/functions/gchat-find-gm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim() })
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (json.ok && json.space) {
        // Correct internal naming (Google uses 'name', App expects 'id')
        const newSpace = { ...json.space, id: json.space.name };

        // Ensure sidebar has the name immediately
        setGchatDmNames(prev => ({ ...prev, [newSpace.id]: targetEmail.trim() }));

        setGchatSpaces(prev => {
          const exists = prev.find(s => s.id === newSpace.id);
          return exists ? prev : [newSpace, ...prev];
        });

        // Switch view and select the session
        setCurrentView({ app: "gchat", contact: null });
        setGchatSelectedSpace(newSpace);
        
        if (newChatEmailRef.current) newChatEmailRef.current.value = "";
        setShowNewChatModal(false); 
        
        lastActiveSpaceRef.current = newSpace;
        localStorage.setItem("LAST_ACTIVE_SPACE_ID", newSpace.id);
      } else {
        alert(json.error || "User not found. Ensure the email is correct.");
      }
    } catch (err) {
      console.error("Initiate chat failed:", err);
      alert("System Error: Could not connect to the chat initiator.");
    } finally {
      setGchatLoading(false);
    }
  };

  /* src/App.jsx - Improved handleSend */
  const handleSend = async () => {
  const text = inputValue.trim();
  if (!text && !pendingUpload) return;

  // WhatsApp (Unchanged)
  if (currentView.app === "whatsapp" && currentView.contact) {
    /* ... keep your existing WhatsApp logic here ... */
    const contact = currentView.contact;
    setWaChats((prev) => {
      const list = prev[contact] ? [...prev[contact]] : [];
      list.push({ from: "me", text, time: formatUKTime(new Date()) });
      return { ...prev, [contact]: list };
    });
    setInputValue("");
    // ... auto reply logic ...
    return;
  }

  // Google Chat Logic
  if (currentView.app === "gchat" && gchatSelectedSpace) {
    try {
      let json = {};

      if (pendingUpload) {
        // --- UPLOAD FLOW ---
        const reader = new FileReader();
        reader.readAsDataURL(pendingUpload.file);
        
        await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64Content = reader.result.split(",")[1];
              
              const res = await fetch("/.netlify/functions/gchat-upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  space: gchatSelectedSpace.id,
                  text: text, 
                  filename: pendingUpload.file.name,
                  mimeType: pendingUpload.file.type,
                  fileBase64: base64Content
                }),
              });
              
              json = await res.json().catch(() => ({}));
              
              if (!res.ok || !json.ok) {
                console.error("Upload failed:", json);
                alert(`Upload failed: ${json.error || "Unknown error"}`);
                reject(); // Stop execution
                return;
              }
              
              resolve(); // Success!
            } catch (e) {
              console.error("Reader/Fetch error:", e);
              reject();
            }
          };
        });

        // ✅ ONLY Clear preview if upload succeeded
        setPendingUpload(null);

      } else {
        // --- TEXT ONLY FLOW ---
        const res = await fetch("/.netlify/functions/gchat-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            space: gchatSelectedSpace.id,
            text,
          }),
        });
        json = await res.json().catch(() => ({}));
      }

      // Success handling
      if (json.ok && json.message) {
        const me = json.message?.sender?.name;
        if (me && !gchatMe) {
          setGchatMe(me);
          localStorage.setItem("GCHAT_ME", me);
        }
        setGchatMessages((prev) => dedupeMergeMessages(prev, [json.message]));
        setInputValue(""); // Clear text box only on success
      }

    } catch (err) {
      console.error("gchat-send/upload failed:", err);
      alert("Message failed to send. Check console.");
    }
    
    // Reset height of text box
    const ta = document.querySelector(".chat-textarea");
    if (ta) {
      ta.style.height = "auto";
      ta.style.overflowY = "hidden";
      ta.closest(".chat-bar")?.classList.remove("expanded");
    }
    return;
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

  if (currentView.app === "gchat") {
    // 👇 Name Sniffer (Keep this)
    const otherPersonName = gchatMessages.find(
      (m) => m?.sender?.name && m.sender.name !== gchatMe
    )?.sender?.displayName;
    // 👇 NEW: PREVIEW INTERCEPTOR
    // If a file is selected, return the Preview UI *instead* of the Chat UI
    if (gchatFilePreview) {
      const isImg = ["img", "png", "jpg", "jpeg", "gif", "webp"].includes(gchatFilePreview.type);
      
      // ✅ CORRECT: The URL is already fully constructed in the onClick handler
      const src = gchatFilePreview.url;

      return (
        <div className="gchat-preview-container">
          <div className="gchat-preview-bar">
            <div className="gchat-preview-title">{gchatFilePreview.name}</div>
            <div className="gchat-preview-actions">
              <a href={src} download={gchatFilePreview.name} className="gchat-preview-btn">Download</a>
              <button className="gchat-preview-close" onClick={() => setGchatFilePreview(null)}>
                ✕ Close
              </button>
            </div>
          </div>
          <div className="gchat-preview-body">
            {isImg ? (
              <img src={src} alt="Preview" className="gchat-preview-img" />
            ) : (
              <iframe src={src} title="Preview" className="gchat-preview-frame" />
            )}
          </div>
        </div>
      );
    }

    // 👇 Standard Chat UI (If no preview is active)
    return (
      <div className="gchat-shell" style={{ display: "flex", height: "100%" }}>
      {/* ... sidebar and thread code ... */}
      {/* LEFT 1/4 — spaces + DMs */}
      <div
        className="gchat-sidebar"
        style={{
          width: "25%",
          borderRight: "1px solid #ddd",
          overflowY: "auto",
          padding: "8px",
          position: "relative"
        }}
        onClick={() => {}}
      >
{/* "Start direct message" Button (Grey Pill, No Plus) */}
        <button 
          style={{ 
            width: "92%", 
            margin: "0 auto 8px auto", 
            padding: "6px 12px",
            borderRadius: "999px", 
            background: "#e0e0e0", 
            color: "#202124",
            border: "none",
            display: "block", 
            textAlign: "center",
            fontSize: "0.85rem", fontWeight: "500", cursor: "pointer"
          }}
          onMouseDown={(e) => { e.stopPropagation(); setShowNewChatModal(true); }}
        >
          Start direct message
        </button>

        {/* Modal Overlay */}
        {showNewChatModal && (
          <>
            {/* Backdrop for instant close */}
            <div 
              style={{ position: "fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex: 99 }}
              onMouseDown={(e) => { e.stopPropagation(); setShowNewChatModal(false); }}
            />
            
            <div 
              style={{
                position: "absolute", top: "50px", left: "10px", right: "10px",
                background: "white", padding: "16px", borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 100, border: "1px solid #ddd"
              }}
              onClick={(e) => e.stopPropagation()} 
            >
              <div style={{fontWeight:500, marginBottom:12, fontSize:"1rem", color:"#202124"}}>
                Start direct message
              </div>
              
              <div style={{fontSize:".8rem", color:"#5f6368", marginBottom:"4px"}}>
                Add 1 or more people
              </div>
              
              <input 
                ref={newChatEmailRef}
                autoFocus
                style={{ width: "100%", padding: "8px 10px", borderRadius: "4px", border: "1px solid #dadce0", marginBottom: "16px", fontSize: ".9rem" }}
                placeholder="Enter email address..."
                defaultValue="" 
                onKeyDown={e => e.key === "Enter" && handleStartChat()}
              />
              
              <div style={{display:"flex", justifyContent:"flex-end", gap:10}}>
                 <button 
                  className="btn ghost" 
                  style={{ borderRadius:4, padding: "6px 12px", color: "#1a73e8", fontWeight: 500, cursor: "pointer" }} 
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowNewChatModal(false); }}
                >
                  Cancel
                </button>
                <button 
                  className="btn blue" 
                  style={{ borderRadius:4, padding: "6px 16px", background: "#1a73e8", fontWeight: 500, cursor: "pointer" }} 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStartChat(); }}
                >
                  Start chat
                </button>
              </div>
            </div>
          </>
        )}

        {gchatLoading && <div className="gchat-muted">Loading…</div>}
        {gchatError && <div className="gchat-error">{gchatError}</div>}

        {!gchatLoading &&
        !gchatError &&
        gchatSpaces.map((s) => {
          // 👇 LOGIC: Check our learned list first. If it's "Direct Message", try the Google name.
          const learnedName = gchatDmNames[s.id];
          const isGeneric = !learnedName || learnedName === "Direct Message";
          
          const title =
            s.type === "DIRECT_MESSAGE"
              ? (isGeneric ? (s.displayName || "Direct Message") : learnedName)
              : s.displayName || "Unnamed";

          return (
            <button
              key={s.id}
              className={`gchat-item ${
                gchatSelectedSpace?.id === s.id ? "active" : ""
              }`}
              style={{
                width: "100%",
                display: "flex",
                gap: "8px",
                padding: "8px",
                marginBottom: "4px",
                textAlign: "left",
              }}
              onClick={() => setGchatSelectedSpace(s)}
            >
              {/* avatar removed intentionally */}
              <div className="gchat-item-text">
                <div className="gchat-item-title">{title}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* RIGHT 3/4 — message thread */}
      <div
        className="gchat-thread"
        style={{
          width: "75%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="gchat-topbar"
          style={{
            borderBottom: "1px solid #ddd",
            padding: "8px",
          }}
        >
          <div className="gchat-top-title">
            {gchatSelectedSpace
              ? gchatSelectedSpace.type === "DIRECT_MESSAGE"
                ? gchatDmNames[gchatSelectedSpace.id] ||
                  gchatSelectedSpace.displayName ||
                  otherPersonName || // 👈 Uses the real name found in messages!
                  "Direct Message"
                : gchatSelectedSpace.displayName || "Unnamed"
              : "Select a space"}
          </div>
        </div>

        <div
          className="gchat-thread-body"
          ref={gchatBodyRef}
          onScroll={() => {
            const el = gchatBodyRef.current;
            if (!el) return;

            const atBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;

            setGchatAutoScroll(atBottom);
          }}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px"
          }}
        >
          {/* 👇 UPDATED: Text removed */}
          {!gchatSelectedSpace && null}

          {gchatSelectedSpace && (
            <>
              {gchatMsgLoading && <div className="gchat-muted">Loading messages…</div>}
              {gchatMsgError && <div className="gchat-error">{gchatMsgError}</div>}

              {!gchatMsgLoading && !gchatMsgError && (
                <div className="gchat-msg-list">
                  {/* src/App.jsx - REPLACING the map inside gchat-msg-list */}
                  {gchatMessages.map((m, idx) => {
                    const msg = normalizeGChatMessage(m);
                    const senderName = msg?.sender?.displayName || "Unknown";
                    const msgId = msg?.name || msg?.id || `${msg?.createTime || "no-ts"}-${idx}`;
                    const avatar = avatarFor(senderName);
                    const isMine = !!gchatMe && msg?.sender?.name === gchatMe;

                    // 👇 DETECT ATTACHMENT
                    const attachment = msg.attachment?.[0] || msg.annotations?.[0]?.userMention?.user ? null : msg.attachment?.[0]; // (simplified check)
                    // Actually, the GChat API structure for attachments is usually msg.attachment[0].
                    // Let's check for "attachment" property which we get from our backend or the API.
                    const hasAttachment = msg.attachment && msg.attachment.length > 0;
                    const fileData = hasAttachment ? msg.attachment[0] : null;
                    
                    // Clean filename for display
                    const fileName = fileData?.contentName || fileData?.name || "Attachment";
  
                    // 👇 Smarter File Type Detection
                    let fileType = "FILE";
                    let iconClass = "default"; // For CSS styling

                    const ext = fileName.split(".").pop().toLowerCase();
                    const isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext);
                    const isAudio = ["mp3", "wav", "m4a", "aac"].includes(ext);

                    if (ext === "pdf") {
                      fileType = "PDF";
                      iconClass = "pdf";
                    } else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
                      fileType = "IMG";
                      iconClass = "img";
                    } else if (["xls", "xlsx", "csv"].includes(ext)) {
                      fileType = "XLS";
                      iconClass = "xls";
                    } else if (["doc", "docx"].includes(ext)) {
                      fileType = "DOC";
                      iconClass = "doc";
                    } else if (["zip", "rar"].includes(ext)) {
                      fileType = "ZIP";
                      iconClass = "zip";
                    } else if (isVideo) {
                      fileType = "VID";
                      iconClass = "img"; // Use purple/img style for video icon fallback
                    } else if (isAudio) {
                      fileType = "AUD";
                      iconClass = "img"; // Use purple/img style for audio icon fallback
                    }

                    return (
                      <div
                        key={msgId}
                        className={`gchat-msg ${isMine ? "mine" : "theirs"}`}
                        style={{ position: "relative" }}
                      >
                        {!isMine && (
                          <div className="gchat-avatar-circle">
                            {avatar ? (
                              <img src={avatar} alt={senderName} />
                            ) : (
                              <span>{senderName.slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                        )}

                        <div
                          className="gchat-msg-content group"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isMine ? "flex-end" : "flex-start",
                            position: "relative",
                            maxWidth: "75%", // Limit width so file cards don't span full screen
                          }}
                        >
                          <div className="gchat-meta">
                            {!isMine && <strong>{senderName}</strong>}
                            <span className="gchat-time">
                              {formatGchatTime(msg?.createTime)}
                            </span>
                          </div>

                          {/* 👇 1. RENDER FILE CARD OR INLINE PLAYER (If exists) */}
                          {hasAttachment && (
                            <div style={{ marginBottom: msg?.text ? "8px" : "0" }}>
                              {isVideo ? (
                                /* A) INLINE VIDEO PLAYER */
                                <div className="gchat-media-wrap">
                                  <video
                                    controls
                                    src={
                                      fileData?.attachmentDataRef?.resourceName
                                        ? `/.netlify/functions/gchat-download?uri=api:${fileData.attachmentDataRef.resourceName}`
                                        : fileData?.downloadUri
                                    }
                                    style={{
                                      maxWidth: "240px",
                                      borderRadius: "8px",
                                      display: "block",
                                      background: "#000",
                                    }}
                                  />
                                </div>
                              ) : isAudio ? (
                                /* B) INLINE AUDIO PLAYER */
                                <div
                                  className="gchat-media-wrap"
                                  style={{ width: "240px" }}
                                >
                                  <audio
                                    controls
                                    src={
                                      fileData?.attachmentDataRef?.resourceName
                                        ? `/.netlify/functions/gchat-download?uri=api:${fileData.attachmentDataRef.resourceName}`
                                        : fileData?.downloadUri
                                    }
                                    style={{ width: "100%" }}
                                  />
                                </div>
                              ) : (
                                /* C) STANDARD FILE CARD (PDF/Docs/Images) */
                                <div
                                  className="gchat-file-card"
                                  style={{ cursor: "pointer" }}
                                  onClick={(e) => {
                                    e.stopPropagation();

                                    // ✅ FIX: Only use the Proxy if we have the specific Resource ID
                                    const resName =
                                      fileData?.attachmentDataRef?.resourceName;
                                    const directUrl = fileData?.downloadUri;

                                    // ✅ FIX: Use full Netlify Functions path
                                    const finalUrl = resName
                                      ? `/.netlify/functions/gchat-download?uri=api:${resName}`
                                      : directUrl;

                                    // 2. Check the file type
                                    const extension = fileName
                                      .split(".")
                                      .pop()
                                      .toLowerCase();
                                    const isViewable = [
                                      "pdf",
                                      "png",
                                      "jpg",
                                      "jpeg",
                                      "gif",
                                      "webp",
                                    ].includes(extension);

                                    if (isViewable) {
                                      // SCENARIO A: Viewable -> Open the Preview Modal
                                      setGchatFilePreview({
                                        name: fileName,
                                        url: finalUrl,
                                        type: iconClass,
                                      });
                                    } else {
                                      // SCENARIO B: Not Viewable (Word/Excel) -> Download Immediately
                                      const link = document.createElement("a");
                                      link.href = finalUrl;
                                      link.setAttribute("download", fileName);
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }
                                  }}
                                >
                                  {/* 👇 Dynamic class added here */}
                                  <div className={`gchat-file-icon ${iconClass}`}>
                                    {fileType}
                                  </div>
                                  <div className="gchat-file-info">
                                    <div className="gchat-file-name">{fileName}</div>
                                    {/* ... */}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 👇 2. RENDER TEXT BUBBLE (If exists) - placed below the file */}
                          {(msg?.text || msg?.formattedText) && (
                            <div className="gchat-bubble" style={{ position: "relative" }}>
                              {/* 👇 Use the helper function here */}
                              {formatChatText(msg?.text || msg?.formattedText)}
                            </div>
                          )}

                          {/* ... (Reaction UI Code remains the same) ... */}
                          {!isMine && (
                            <div className="gchat-react-bar">
                              {/* ... buttons ... */}
                              <button className="gchat-reaction-pill" onMouseDown={(e) => {e.stopPropagation(); e.preventDefault(); toggleReaction(msgId, "like");}}>👍</button>
                              <button className="gchat-reaction-pill" onMouseDown={(e) => {e.stopPropagation(); e.preventDefault(); toggleReaction(msgId, "heart");}}>❤️</button>
                              <button className="gchat-reaction-pill" onMouseDown={(e) => {e.stopPropagation(); e.preventDefault(); toggleReaction(msgId, "laugh");}}>😆</button>
                            </div>
                          )}

                          {/* ... (Rendered Reactions Code remains the same) ... */}
                          {Array.isArray(reactions[msgId]) && reactions[msgId].length > 0 && (
                            <div className="gchat-reaction-row" style={{ marginTop: 4, display: "flex", gap: 4 }}>
                              {reactions[msgId].map((r) => (
                                <button key={r} onClick={(e) => {e.stopPropagation(); toggleReaction(msgId, r);}} className="gchat-reaction-chip-btn">
                                  {r === "like" ? "👍 1" : r === "heart" ? "❤️ 1" : "😆 1"}
                                </button>
                              ))}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

      if (currentView.app === "gmail") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff", borderRadius: "12px", border: "1px solid #e6e6e6", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", background: "#f8f9fa", fontWeight: 600, fontSize: "15px", color: "#202124", display: "flex", alignItems: "center", gap: "8px" }}>
          <img src={gmailIcon} alt="Gmail" style={{ width: 20, height: 20 }} />
          Inbox - {PERSONA.toUpperCase() === "SIYA" ? "siya@actuaryspace.co.za" : "yolandie@actuaryspace.co.za"}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
          {gmailLoading && <div style={{ padding: "16px", color: "#5f6368" }}>Loading inbox...</div>}
          {gmailError && <div style={{ padding: "16px", color: "#ea4335" }}>Error: {gmailError}</div>}
          
          {!gmailLoading && !gmailError && gmailEmails.length === 0 && (
            <div style={{ padding: "16px", color: "#5f6368", textAlign: "center", marginTop: "20px" }}>No emails found.</div>
          )}

          {!gmailLoading && !gmailError && gmailEmails.map((msg, i) => (
            <div 
              key={msg.id || i}
              style={{ 
                display: "flex", 
                padding: "10px 16px", 
                borderBottom: "1px solid #f1f3f4",
                cursor: "pointer",
                background: msg.isUnread ? "#ffffff" : "#f2f6fc",
                fontWeight: msg.isUnread ? 700 : 400,
                alignItems: "center",
                gap: "12px",
                fontSize: "14px"
              }}
       onMouseEnter={(e) => e.currentTarget.style.boxShadow = "inset 1px 0 0 #dadce0, inset -1px 0 0 #dadce0, 0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)"}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
         onClick={() => {
  // 1. Mark as read in the UI instantly
  setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isUnread: false } : e));
  
  // Call backend to mark as read permanently
  if (msg.isUnread) {
    fetch("/.netlify/functions/gmail-mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msg.id })
    }).catch(err => console.error("Mark read failed", err));
  }
  
  // 2. Parse sender details
  const fromParts = msg.from ? msg.from.split("<") : ["Unknown", ""];
  const fromName = fromParts[0].replace(/"/g, '').trim();
  const fromEmail = fromParts[1] ? "<" + fromParts[1] : "";

  // 3. Set the active email data - NOW USING msg.body
  setEmail({
    id: msg.id,
    subject: msg.subject,
    fromName: fromName,
    fromEmail: fromEmail,
    time: new Date(msg.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    body: msg.body || msg.snippet, // Use the multi-line body from our updated function
    attachments: msg.subject.includes("Payslips") ? [
      { name: "Payslips.pdf", url: "/pdfs/Payslips.pdf", type: "pdf" }
    ] : [],
    actions: [
      { key: "submit_trello", label: "Submit to Trello" },
      { key: "update_tracker", label: "Update AC Tracker" },
    ]
  });

  // 4. Clear any existing right-pane files, then switch view
  setEmailPreview(null);
  setCurrentView({ app: "email", contact: null });
}}
            >
              <div style={{ width: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#202124" }}>
                {msg.from ? msg.from.split("<")[0].replace(/"/g, '').trim() : "(Unknown)"}
              </div>
              <div style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ color: "#202124", marginRight: "6px" }}>{msg.subject}</span>
                <span style={{ color: "#5f6368", fontWeight: 400 }}>- {msg.snippet}</span>
              </div>
              <div style={{ width: "80px", textAlign: "right", fontSize: "12px", color: msg.isUnread ? "#1a73e8" : "#5f6368" }}>
                {msg.date ? new Date(msg.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
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
          <div className="email-head" style={{ alignItems: 'center', gap: '12px' }}>
            {/* 🔙 NEW: Back Button to return to Inbox */}
            <button 
              onClick={() => setCurrentView({ app: "gmail", contact: null })}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#5f6368',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
              title="Back to Inbox"
            >
              ←
            </button>
            <div className="email-from" style={{ flex: 1 }}>
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
    <div 
      className="email-body-text" 
      style={{ 
        whiteSpace: "pre-wrap", 
        lineHeight: "1.5", 
        fontFamily: "Verdana, Geneva, sans-serif",
        fontSize: "14px",
        color: "#202124",
        padding: "12px 0"
      }}
    >
      {email.body || ""}
    </div>
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

    /* Trello modal (Real App Style) */
  if (currentView.app === "trello" && trelloCard) {
    const c = trelloCard;
    const fields = (c.customFields && Object.keys(c.customFields).length)
      ? c.customFields
      : parseCustomFieldsFromBadges(c.badges || []);

    return (
      <div className="trello-modal">
        {/* 1. TOP BAR (Icon + Title + Close) */}
        <div className="trello-modal-topbar">
          <div className="trello-header-main">
            <div className="trello-icon-header">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <line x1="7" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="2"/>
               </svg>
            </div>
            <div style={{ flex: 1 }}>
              <input 
                className="trello-title-input" 
                value={c.title} 
                onChange={(e) => setTrelloCard(prev => ({...prev, title: e.target.value}))}
              />
              <div className="trello-list-subtitle">
                in list <a href="#">{c.boardList || "Yolandie to Send"}</a>
              </div>
            </div>
          </div>
          <button 
            className="trello-close"
            onClick={() => { setTrelloMenuOpen(false); setTrelloCard(null); }}
          >✕</button>
        </div>

        {/* 2. BODY (Columns) */}
        <div className="trello-modal-body">
          
          {/* LEFT COLUMN (75%) */}
          <div className="trello-main-col">
            
            {/* Action Row (Buttons under title) */}
            <div className="trello-action-row">
               <button className="t-btn-gray">
                  <span>+</span> Add
               </button>
               <button className="t-btn-gray">
                  <span>🕒</span> Dates
               </button>
               <button className="t-btn-gray">
                  <span>☑</span> Checklist
               </button>
               <button className="t-btn-gray">
                  <span>👤</span> Members
               </button>
               <button className="t-btn-gray">
                  <span>📎</span> Attachment
               </button>
            </div>

            {/* Members & Labels Section (Fixed Layout & Sizing) */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 24, paddingLeft: 40, flexWrap: 'wrap' }}>
               
               {/* 1. Members Group */}
               <div>
                  <h3 className="trello-group-label">Members</h3>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                     {(c.members || []).map((m, i) => {
                        const img = avatarFor(m);
                        return (
                           <div key={i} className="member-avatar" title={m}>
                              {img ? <img src={img} alt={m} /> : m.slice(0,1)}
                           </div>
                        );
                     })}
                     <button className="round-btn-gray" title="Add member">
                        <span>+</span>
                     </button>
                  </div>
               </div>

               {/* 2. Labels Group */}
               <div style={{ position: 'relative' }}>
                  <h3 className="trello-group-label">Labels</h3>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                     {/* Render actual active labels - NOW CLICKABLE */}
                     {(c.labels || []).map((l, i) => {
                        const style = getLabelStyle(l);
                        return (
                           <div 
                             key={i} 
                             className="label-pill-large" 
                             style={style}
                             onClick={(e) => { e.stopPropagation(); setShowLabelPicker(true); }}
                           >
                              {l}
                           </div>
                        );
                     })}
                     
                     {/* Plus Button */}
                     <button 
                        className="rect-btn-gray" 
                        title="Add label"
                        onClick={(e) => { e.stopPropagation(); setShowLabelPicker(!showLabelPicker); }}
                     >
                        <span>+</span>
                     </button>

                     {/* 🔽 POPUP LABEL PICKER (Checkboxes) 🔽 */}
                     {showLabelPicker && (
                       <div className="label-picker-popover" onClick={(e) => e.stopPropagation()}>
                         <div className="label-picker-header">
                           <span>Labels</span>
                           <button 
                             className="label-picker-close" 
                             onClick={(e) => { e.stopPropagation(); setShowLabelPicker(false); }}
                           >✕</button>
                         </div>
                         <div className="label-picker-list">
                           {ALL_LABEL_OPTIONS.map((opt) => {
                             const isActive = (c.labels || []).includes(opt.name);
                             return (
                               <div key={opt.name} className="label-picker-row">
                                 <div 
                                   className="label-picker-pill" 
                                   style={{ backgroundColor: opt.bg, color: opt.color, display: 'flex', alignItems: 'center', gap: '8px' }}
                                   onClick={async (e) => {
                                      e.stopPropagation(); // Prevent closing
                                      
                                      // 1. Optimistic Update
                                      const newLabels = isActive 
                                        ? c.labels.filter(l => l !== opt.name)
                                        : [...(c.labels || []), opt.name];
                                      
                                      setTrelloCard(prev => ({ ...prev, labels: newLabels }));

                                      try {
                                        // 2. Call Backend
                                        await fetch("/.netlify/functions/trello-toggle-label", {
                                          method: "POST",
                                          body: JSON.stringify({ 
                                            cardId: c.id, 
                                            labelName: opt.name, 
                                            shouldAdd: !isActive 
                                          })
                                        });
                                        
                                        // 3. Patch bucket
                                        window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                          detail: { cardId: c.id, updater: old => ({ ...old, labels: newLabels }) }
                                        }));
                                      } catch(err) {
                                        console.error("Label toggle failed", err);
                                      }
                                   }}
                                 >
                                   {/* CHECKBOX ON LEFT */}
                                   <input 
                                     type="checkbox" 
                                     checked={isActive} 
                                     readOnly 
                                     style={{ cursor: 'pointer', width: 16, height: 16 }} 
                                   />
                                   <span style={{flex: 1}}>{opt.name}</span>
                                 </div>
                                 <button className="label-edit-icon">✎</button>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     )}
                  </div>
               </div>
            </div>

            {/* Description */}
            <div className="trello-section">
              <div className="trello-section-icon">≡</div>
              <div className="trello-section-header">
                 <h3 className="trello-h3">Description</h3>
                 {!descEditing && (
                   <button 
                     className="t-btn-gray"
                     onClick={() => { setDescDraft(c.description || ""); setDescEditing(true); }}
                   >Edit</button>
                 )}
              </div>
              {!descEditing ? (
                 <div 
                   className="desc-box-fake"
                   onClick={() => { setDescDraft(c.description || ""); setDescEditing(true); }}
                   style={{ minHeight: '60px', whiteSpace: 'pre-wrap' }}
                 >
                   {c.description || <span style={{color:'#5e6c84'}}>Add a more detailed description...</span>}
                 </div>
              ) : (
                 <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
                   <textarea 
                     className="trello-title-input"
                     style={{ minHeight: 108, border: '2px solid #0079bf', background:'#fff', fontSize:14, fontWeight:400, padding: '8px 12px', resize:'vertical' }}
                     value={descDraft}
                     onChange={e => setDescDraft(e.target.value)}
                     autoFocus
                     placeholder="Add a more detailed description..."
                   />
                   <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button 
                        className="btn-blue"
                        onClick={async () => {
                          const newDesc = descDraft;
                          const prevDesc = c.description;
                          
                          // 1. Optimistic Update (Instant on screen)
                          setTrelloCard(prev => ({ ...prev, description: newDesc }));
                          setDescEditing(false);

                          try {
                            // 2. Send to Trello (Backend)
                            await setCardDescription(c.id, newDesc);
                            
                            // 3. Update the hidden list view so it sticks if you close/reopen
                            window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ ...old, description: newDesc }) }
                            }));
                          } catch (err) {
                            console.error(err);
                            // Revert on failure
                            setTrelloCard(prev => ({ ...prev, description: prevDesc }));
                            alert("Failed to save description");
                          }
                        }}
                      >
                        Save
                      </button>
                      <button 
                        className="t-btn-gray" 
                        onClick={() => setDescEditing(false)}
                      >
                        Cancel
                      </button>
                   </div>
                 </div>
              )}
            </div>

            {/* Custom Fields (GRID LAYOUT) */}
            <div className="trello-section">
               <div className="trello-section-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <rect x="3" y="3" width="18" height="18" rx="2" />
                     <line x1="3" y1="9" x2="21" y2="9" />
                  </svg>
               </div>
               <div className="trello-section-header">
                  <h3 className="trello-h3">Custom Fields</h3>
               </div>
               
               <div className="cf-grid">
                  {/* 1. Priority */}
                  <div className="cf-item">
                     <span className="cf-label">Priority</span>
                     <select 
                        className={`cf-select-box ${getCFColorClass("Priority", fields.priority)}`}
                        value={fields.priority || ""}
                        onChange={async (e) => {
                           const val = e.target.value;
                           
                           // 1. Optimistic UI Update
                           setTrelloCard(prev => {
                              const cleanBadges = (prev.badges || []).filter(b => !b.text.startsWith("Priority:"));
                              if (val) cleanBadges.push({ text: `Priority: ${val}`, isBottom: true });
                              return { 
                                 ...prev, 
                                 badges: ensureBadgeTypes(cleanBadges),
                                 customFields: { ...prev.customFields, priority: val }
                              };
                           });

                           // 2. Notify other components
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Priority" } }));

                           // 3. Save to Backend (Using YOUR existing function)
                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST",
                                 body: JSON.stringify({ 
                                    cardId: c.id, 
                                    fieldName: "Priority", 
                                    valueText: val // 👈 Match your function's expected key
                                 })
                              });
                              // Force update buckets to keep everything in sync
                              window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                 detail: { cardId: c.id, updater: old => ({ ...old, customFields: { ...old.customFields, Priority: val } }) }
                              }));
                           } catch (err) { console.error("Priority save failed", err); }
                        }} 
                     >
                        <option value="">(None)</option>
                        {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                     </select>
                  </div>

                  {/* 2. Status */}
                  <div className="cf-item">
                     <span className="cf-label">Status</span>
                     <select 
                        className={`cf-select-box ${getCFColorClass("Status", fields.status)}`}
                        value={fields.status || ""}
                        onChange={async (e) => {
                           const val = e.target.value;
                           
                           setTrelloCard(prev => {
                              const cleanBadges = (prev.badges || []).filter(b => !b.text.startsWith("Status:"));
                              if (val) cleanBadges.push({ text: `Status: ${val}`, isBottom: true });
                              return { 
                                 ...prev, 
                                 badges: ensureBadgeTypes(cleanBadges),
                                 customFields: { ...prev.customFields, status: val }
                              };
                           });
                           
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Status" } }));

                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST",
                                 body: JSON.stringify({ 
                                    cardId: c.id, 
                                    fieldName: "Status", 
                                    valueText: val 
                                 })
                              });
                              window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                 detail: { cardId: c.id, updater: old => ({ ...old, customFields: { ...old.customFields, Status: val } }) }
                              }));
                           } catch (err) { console.error("Status save failed", err); }
                        }}
                     >
                        <option value="">(None)</option>
                        {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                     </select>
                  </div>

                  {/* 3. Active */}
                  <div className="cf-item">
                     <span className="cf-label">Active</span>
                     <select 
                        className={`cf-select-box ${getCFColorClass("Active", fields.active)}`}
                        value={fields.active || ""}
                        onChange={async (e) => {
                           const val = e.target.value;

                           setTrelloCard(prev => {
                              const cleanBadges = (prev.badges || []).filter(b => !b.text.startsWith("Active:"));
                              if (val) cleanBadges.push({ text: `Active: ${val}`, isBottom: true });
                              return { 
                                 ...prev, 
                                 badges: ensureBadgeTypes(cleanBadges),
                                 customFields: { ...prev.customFields, active: val }
                              };
                           });

                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Active" } }));

                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST",
                                 body: JSON.stringify({ 
                                    cardId: c.id, 
                                    fieldName: "Active", 
                                    valueText: val 
                                 })
                              });
                              window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                 detail: { cardId: c.id, updater: old => ({ ...old, customFields: { ...old.customFields, Active: val } }) }
                              }));
                           } catch (err) { console.error("Active save failed", err); }
                        }}
                     >
                        <option value="">(None)</option>
                        {ACTIVE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                     </select>
                  </div>
               </div>
            </div>

{/* WORKFLOW TIMER (NEW) */}
            <div className="trello-section">
               <div className="trello-section-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <circle cx="12" cy="12" r="10" />
                     <path d="M12 6v6l4 2" />
                  </svg>
               </div>
               <div className="trello-section-header">
                  <h3 className="trello-h3">WorkFlow</h3>
               </div>
               
               <div className="timer-row" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {parseFloat(c.customFields?.WorkTimerStart) > 1000000000000 ? (
                      <button 
                        className="btn-red" 
                        style={{ backgroundColor: '#eb5a46', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', width: '105px', textAlign: 'center' }}
                        onClick={async () => {
                           const stopTime = Date.now();
                           const startTime = parseFloat(c.customFields.WorkTimerStart);
                           const sessionMins = (stopTime - startTime) / 1000 / 60;
                           const oldDur = parseFloat(c.customFields.WorkDuration || "0");
                           const newTotal = (oldDur + sessionMins).toFixed(2);
                           
                           // Lock local state
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkDuration", ttlMs: 10000 } }));
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkTimerStart", ttlMs: 10000 } }));

                           // Update modal UI instantly
                           setTrelloCard(prev => ({
                              ...prev,
                              customFields: { ...prev.customFields, WorkTimerStart: null, WorkDuration: newTotal }
                           }));

                           // Sync background list
                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, WorkTimerStart: null, WorkDuration: newTotal } 
                              }) }
                           }));

                           // Push to Trello using your guaranteed working API
                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST",
                                 body: JSON.stringify({ cardId: c.id, fieldName: "WorkDuration", valueText: String(newTotal) })
                              });
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST",
                                 body: JSON.stringify({ cardId: c.id, fieldName: "WorkTimerStart", valueText: "" })
                              });
                           } catch(err) { console.error("WorkFlow Timer Stop Failed", err); }
                        }}
                      >
                        Stop
                      </button>
                  ) : (
                      <button 
                        className="btn-yellow"
                        style={{ backgroundColor: '#f2d600', color: '#172b4d', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', width: '105px', textAlign: 'center' }}
                        onClick={async () => {
                           const now = Date.now();
                           
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkTimerStart", ttlMs: 10000 } }));

                           setTrelloCard(prev => ({
                              ...prev,
                              customFields: { ...prev.customFields, WorkTimerStart: now }
                           }));

                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, WorkTimerStart: now } 
                              }) }
                           }));

                           // Push to Trello using your guaranteed working API
                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST",
                                 body: JSON.stringify({ cardId: c.id, fieldName: "WorkTimerStart", valueText: String(now) })
                              });
                           } catch(err) { console.error("WorkFlow Timer Start Failed", err); }
                        }}
                      >
                        Start timer
                      </button>
                  )}

                  <div className="timer-display">
                     <LiveTimer 
                        startTime={c.customFields?.WorkTimerStart} 
                        duration={c.customFields?.WorkDuration} 
                     />
                  </div>  
               </div>
            </div>

            {/* Activity Timer */}
            <div className="trello-section">
               <div className="trello-section-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <circle cx="12" cy="12" r="10" />
                     <polyline points="12 6 12 12 16 14" />
                  </svg>
               </div>
               <div className="trello-section-header">
                  <h3 className="trello-h3">Activity Timer</h3>
               </div>
               
               <div className="timer-row" style={{ position: 'relative' }}>
                  {/* START / STOP BUTTON */}
                  {c.customFields?.TimerStart ? (
                      <button 
                        className="btn-red" 
                        style={{ backgroundColor: '#eb5a46', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
                        onClick={async () => {
                           // --- STOP LOGIC ---
                           const stopTime = Date.now();
                           const startTime = parseFloat(c.customFields.TimerStart);
                           const sessionMins = (stopTime - startTime) / 1000 / 60;
                           const oldDur = parseFloat(c.customFields.Duration || "0");
                           const newTotal = (oldDur + sessionMins).toFixed(2);
                           
                           // 1. Trigger Protection (10s)
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Duration", ttlMs: 10000 } }));
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "TimerStart", ttlMs: 10000 } }));

                           // 2. Update UI
                           setTrelloCard(prev => ({
                              ...prev,
                              customFields: { ...prev.customFields, TimerStart: null, Duration: newTotal }
                           }));

                           // 3. Send to Trello
                           await fetch("/.netlify/functions/trello-timer", {
                              method: "POST",
                              body: JSON.stringify({ cardId: c.id, action: "stop" })
                           });
                           
                           // 4. Sync Buckets
                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, TimerStart: null, Duration: newTotal } 
                              }) }
                           }));
                        }}
                      >
                        Stop
                      </button>
                  ) : (
                      <button 
                        className="btn-blue"
                        onClick={async () => {
                           // --- START LOGIC ---
                           const now = Date.now();
                           
                           // 1. Trigger Protection (10s)
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "TimerStart", ttlMs: 10000 } }));

                           // 2. Update UI
                           setTrelloCard(prev => ({
                              ...prev,
                              customFields: { ...prev.customFields, TimerStart: now }
                           }));

                           // 3. Send to Trello
                           await fetch("/.netlify/functions/trello-timer", {
                              method: "POST",
                              body: JSON.stringify({ cardId: c.id, action: "start" })
                           });

                           // 4. Sync Buckets
                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, TimerStart: now } 
                              }) }
                           }));
                        }}
                      >
                        Start timer
                      </button>
                  )}

                  {/* ADD TIME BUTTON */}
                  <button 
                     className="t-btn-gray" 
                     title="Add manual time"
                     onClick={() => setShowAddTime(!showAddTime)}
                  >
                     <span>+</span> Add time
                  </button>

                  {/* POPUP FOR MANUAL TIME */}
                  {showAddTime && (
                    <div className="label-picker-popover" style={{ width: 260, top: 45, left: 80, padding: 16, cursor: 'default' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontWeight: 600, color: '#172b4d' }}>Add time tracking</span>
                          <button onClick={() => setShowAddTime(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>✕</button>
                       </div>
                       
                       <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                          <div style={{ flex: 1 }}>
                             <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5e6c84', marginBottom: 4 }}>Hours</label>
                             <input 
                                type="number" min="0" 
                                value={manualHours} 
                                onChange={e => setManualHours(e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 3, border: '2px solid #dfe1e6' }}
                             />
                          </div>
                          <div style={{ flex: 1 }}>
                             <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5e6c84', marginBottom: 4 }}>Minutes</label>
                             <input 
                                type="number" min="0" 
                                value={manualMins} 
                                onChange={e => setManualMins(e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 3, border: '2px solid #dfe1e6' }}
                             />
                          </div>
                       </div>

                       <button 
                          className="btn-blue" 
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={async () => {
                             const h = parseFloat(manualHours) || 0;
                             const m = parseFloat(manualMins) || 0;
                             const addedMinutes = (h * 60) + m;

                             if (addedMinutes > 0) {
                                const oldDur = parseFloat(c.customFields.Duration || "0");
                                const newTotal = (oldDur + addedMinutes).toFixed(2);

                                // 1. Trigger Protection (10s)
                                window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Duration", ttlMs: 10000 } }));

                                // 2. Update UI
                                setTrelloCard(prev => ({
                                   ...prev,
                                   customFields: { ...prev.customFields, Duration: newTotal }
                                }));
                                setShowAddTime(false);
                                setManualHours("0");
                                setManualMins("0");

                                // 3. Backend Save
                                await fetch("/.netlify/functions/trello-set-custom-field", {
                                   method: "POST",
                                   body: JSON.stringify({ 
                                      cardId: c.id, 
                                      fieldName: "Duration", 
                                      valueText: newTotal 
                                   })
                                });

                                // 4. Sync Buckets
                                window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                                   detail: { cardId: c.id, updater: old => ({ 
                                      ...old, customFields: { ...old.customFields, Duration: newTotal } 
                                   }) }
                                }));
                             }
                          }}
                       >
                          Add time
                       </button>
                    </div>
                  )}
                  
                  {/* LIVE COUNTER */}
                  <div className="timer-display">
                     <LiveTimer 
                        startTime={c.customFields?.TimerStart} 
                        duration={c.customFields?.Duration} 
                     />
                  </div>

                  <div className="timer-estimate" style={{marginLeft:8, fontSize:12, color:'#5e6c84'}}>
                     Estimate: 0m
                  </div>
               </div>
               
               {/* 🗑️ BANNER REMOVED */}
            </div>

            {/* Time */}
            <div className="trello-section">
               <div className="trello-section-icon">⏱</div>
               <div className="trello-section-header">
                  <h3 className="trello-h3">Time</h3>
               </div>
               <button className="t-btn-gray">Start Timer</button>
            </div>

          </div>

          {/* RIGHT COLUMN (Comments & Activity) */}
          <div className="trello-sidebar-col">
             <div className="trello-section-header" style={{justifyContent:'space-between'}}>
                <h3 className="trello-h3">Comments and activity</h3>
                <button className="t-btn-gray" style={{fontSize:12, padding:'4px 8px'}}>Show details</button>
             </div>
             
             {/* Input Area */}
             <div style={{display:'flex', gap:8, marginBottom:16}}>
                <div className="member-avatar" style={{width:32, height:32}}>
                   {PERSONA.slice(0,1)}
                </div>
                <div style={{flex:1}}>
                   <input 
                      className="activity-input" 
                      placeholder="Write a comment..." 
                      style={{borderRadius:8}}
                   />
                </div>
             </div>

             {/* Activity Stream */}
             <div className="tr-feed">
               {(c.activity || []).map((a, i) => (
                 <div key={i} className="tr-item">
                   <div className="tr-avatar">
                     {avatarFor(a.who) ? <img src={avatarFor(a.who)} alt={a.who}/> : <div className="tr-initial">{a.who.slice(0,1)}</div>}
                   </div>
                   <div className="tr-bubble" style={{background:'transparent', border:0, padding:0}}>
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

        // WhatsApp
        waChats,

        // Google Chat (IMPORTANT — this is the fix)
        gchatSpaces,
        gchatLoading,
        gchatError,
        gchatSelectedSpace,
        gchatMessages,
        gchatMsgLoading,
        gchatMsgError,
        gchatDmNames,
        gchatMe,

        // Email
        email,
        emailPreview,
        showDraftPicker,
        selectedDraftTemplate,
        draftTo,

        // Gmail Inbox
        gmailEmails,
        gmailLoading,
        gmailError,

        // Trello
        trelloCard,
        trelloMenuOpen,
        descEditing,
        descDraft,
        showLabelPicker, 
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
                  dismissNotification(n);
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
        <div className="panel-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: "24px", paddingLeft: "12px" }}>
          
          {/* LEFT SIDE: Google Chat & Gmail Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="connect-google-btn"
              onClick={() => {
                setGchatSelectedSpace(null); // 👈 Force clear selection instantly
                setInputValue("");           // 👈 Clear any lingering text
                setCurrentView({ app: "gchat", contact: null });
              }}
              type="button"
            >
              <img src={gchatIcon} alt="GChat" />
              Google Chat
            </button>

            <button
              className="connect-google-btn"
              onClick={() => {
                setInputValue("");
                setCurrentView({ app: "gmail", contact: null });
              }}
              type="button"
            >
              <img src={gmailIcon} alt="Gmail" />
              Gmail
            </button>
          </div>

          {/* RIGHT SIDE: Connect + Close App Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a
              href="/.netlify/functions/google-auth-start"
              className="connect-google-btn"
            >
              Connect / Reconnect Google
            </a>

            {/* 👇 NEW: Close App Button (Only shows when in an app) */}
            {currentView.app !== "none" && (
              <button
                onClick={() => setCurrentView({ app: "none", contact: null })}
                style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  border: "1px solid #dadce0", background: "white",
                  display: "grid", placeItems: "center", cursor: "pointer",
                  color: "#5f6368", fontSize: "18px", fontWeight: "300"
                }}
                title="Close App"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="middle-content">{middleContent}</div>

        <input
          ref={fileInputRef}
          type="file"
          /* 👇 1. Allow Images, PDF, Excel, Word, AUDIO, VIDEO */
          accept="application/pdf, image/png, image/jpeg, .xlsx, .xls, .docx, .doc, audio/*, video/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;

            // 👇 2. Strict Netlify Limit (4.5MB safe limit for Base64 encoding)
            if (f.size > 4.5 * 1024 * 1024) {
              alert("Netlify Limit: File must be under 4.5MB.");
              return;
            }

            setPendingUpload({ file: f, kind: "file" });
            setShowPlusMenu(false);
            e.target.value = "";
          }}
        />

        <div className={`chat-bar ${pendingUpload ? "has-file" : ""}`}>
          {pendingUpload && (
            <div className="chat-upload-preview">
              <div className="chat-upload-card" title={pendingUpload.file.name}>
                <div className="chat-upload-icon">PDF</div>
                <div className="chat-upload-meta">
                  <div className="chat-upload-name">{pendingUpload.file.name}</div>
                  <div className="chat-upload-size">
                    {(pendingUpload.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  className="chat-upload-remove"
                  type="button"
                  onClick={() => setPendingUpload(null)}
                  aria-label="Remove upload"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="chat-input-row" style={{ alignItems: "flex-end" }}>
            
            {/* 1. TEXT AREA */}
            <textarea
              ref={chatTextareaRef}
              className="chat-textarea"
              placeholder={
                isRecording
                  ? "Recording audio..."
                  /* 👇 REMOVED: The check for GChat && !space so it defaults to "Ask anything" below */
                  : currentView.app === "whatsapp" && currentView.contact
                  ? `Message ${currentView.contact}`
                  : currentView.app === "email"
                  ? "Add a note..."
                  : "Ask anything" /* Covers Home, GChat (Empty), and GChat (Active) */
              }
              rows={1}
              value={inputValue}
              disabled={isRecording}
              onChange={(e) => setInputValue(e.target.value)}
              onInput={(e) => handleAutoGrow(e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  if (currentView.app === "gchat" && !gchatSelectedSpace) return;
                  e.preventDefault();
                  handleSend();
                }
              }}
              style={{
                flex: 1,
                minHeight: "40px",
                paddingTop: "10px",
                marginBottom: "2px"
              }}
            />

            {/* 2. RIGHT ACTIONS CONTAINER */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "4px", paddingLeft: "4px" }}>
              
              {/* A) MIC or SEND BUTTON */}
              {inputValue.trim() || pendingUpload ? (
                /* SEND BUTTON: Black Circle (Smaller: 28px) */
                <button 
                  className="send-btn" 
                  onClick={handleSend} 
                  aria-label="Send"
                  style={{ 
                    width:"28px", height:"28px", borderRadius:"50%", 
                    display:"grid", placeItems:"center", 
                    border:"none", background:"#000", 
                    cursor:"pointer", color: "white" 
                  }} 
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    width="14" height="14" 
                    fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              ) : (
                /* MIC BUTTON: Only show if in an active chat (GChat Space or WhatsApp Contact) */
                ((currentView.app === "gchat" && gchatSelectedSpace) || (currentView.app === "whatsapp" && currentView.contact)) && (
                  <button
                    className={`mic-btn ${isRecording ? "recording" : ""}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    title={isRecording ? "Stop Recording" : "Record Voice Note"}
                    style={{
                      border: "none",
                      background: isRecording ? "#fce8e6" : "transparent",
                      color: isRecording ? "#ea4335" : "#5f6368",
                      borderRadius: "50%",
                      width: "34px",
                      height: "34px",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      transition: "all 0.2s ease"
                    }}
                  >
                     {isRecording ? (
                       <div style={{width:"12px", height:"12px", background:"#ea4335", borderRadius:"2px"}} />
                     ) : (
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                         <path d="M12 6a2 2 0 0 0-2 2v5a2 2 0 0 0 4 0V8a2 2 0 0 0-2-2Z" />
                         <path d="M18 13v-2a6 6 0 0 1-12 0v2" strokeOpacity="0.8" />
                         <line x1="12" y1="19" x2="12" y2="21" />
                         <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
                       </svg>
                     )}
                  </button>
                )
              )}

              {/* B) PLUS BUTTON (To the RIGHT of Mic/Send) */}
              {currentView.app === "gchat" && gchatSelectedSpace && (
                <div className="chat-plus-wrap" style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="chat-plus-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlusMenu((v) => !v);
                    }}
                    aria-label="More"
                    style={{ 
                      width:"34px", height:"34px", borderRadius:"50%", 
                      border:"1px solid #ddd", background:"transparent", 
                      fontSize:"22px", color:"#5f6368", fontWeight: "300",
                      display:"grid", placeItems:"center", cursor:"pointer" 
                    }}
                  >
                    +
                  </button>

                  {showPlusMenu && (
                    <div className="chat-plus-menu" style={{ right: 0, left: "auto", bottom: "45px" }}>
                      <button
                        type="button"
                        className="chat-plus-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPlusMenu(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        Upload file
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* RIGHT */}
      <RightPanel />
    </div>
  </PasswordGate>
);
}

// --- Place this at the bottom of App.jsx ---
function LiveTimer({ startTime, duration }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Tick every second to update the UI
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 🛡️ SHIELD 1: If Duration is corrupted, visually reset it
  let baseMinutes = parseFloat(duration || "0");
  if (baseMinutes > 1000000) baseMinutes = 0;

  let currentSessionMinutes = 0;

  if (startTime) {
    const start = parseFloat(startTime);
    // 🛡️ SHIELD 2: Only tick if the start time is a massive, valid Unix Timestamp
    if (start > 1000000000000) {
      const diff = Math.max(0, now - start);
      currentSessionMinutes = diff / 1000 / 60;
    }
  }

  const totalMins = Math.floor(baseMinutes + currentSessionMinutes);

  // 🕒 Smart Time Formatting (Converts to Hours and Minutes)
  let displayTime = `${totalMins}m`;
  if (totalMins >= 60) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    displayTime = m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return <span>⏱ {displayTime}</span>;
}