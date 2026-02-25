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

  // This puts the largest (newest) timestamp at the top
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
const AC_EMAIL_MAP = {
  "Namir": "namir@actuaryconsulting.co.za",
  "Joel": "joel@actuaryconsulting.co.za",
  "Dionee": "dionee@actuaryconsulting.co.za",
  "Simoné": "simone@actuaryconsulting.co.za",
  "Ryan": "ryan@actuaryconsulting.co.za",
  "Conah": "conah@actuaryconsulting.co.za",
  "Thami": "thami@actuaryconsulting.co.za",
  "Melissa": "melissa@actuaryconsulting.co.za",
  "Waldo": "waldo@actuaryconsulting.co.za",
  "Melvin": "melvin@actuaryconsulting.co.za",
  "Tiffany": "tiffany@actuaryconsulting.co.za",
  "Albert": "albert@actuaryconsulting.co.za",
  "Alicia K": "aliciak@actuaryconsulting.co.za",
  "Alicia O": "aliciao@actuaryconsulting.co.za",
  "Ethan": "ethan@actuaryconsulting.co.za",
  "Martin": "martin@actuaryconsulting.co.za",
  "Leonah": "leonah@actuaryconsulting.co.za",
  "Matthew": "matthew@actuaryconsulting.co.za",
  "Siyabonga": "siya@actuaryspace.co.za",
  "Enock": "enock@actuaryconsulting.co.za",
  "Treasure": "treasure@actuaryconsulting.co.za",
  "Melokuhle": "melokuhle@actuaryconsulting.co.za",
  "Eugene": "eugene@actuaryconsulting.co.za",
  "Bianca": "bianca@actuaryconsulting.co.za",
  "Jonathan": "jonathan@actuaryconsulting.co.za",
  "Bonolo": "bonolo@actuaryconsulting.co.za",
  "Willem": "willem@actuaryconsulting.co.za",
  "Shamiso": "shamiso@actuaryconsulting.co.za",
  "Miné": "mine@actuaryconsulting.co.za",
  "Songeziwe": "songeziwe@actuaryconsulting.co.za",
  "Michelle": "michelle@actuaryconsulting.co.za",
  "Kwakhanya": "kwakhanya@actuaryconsulting.co.za",
  "Jennifer": "jennifer@actuaryconsulting.co.za",
  "Munyaradzi": "munyaradzi@actuaryconsulting.co.za",
  "Leroy": "leroy@actuaryconsulting.co.za",
  "Cameron": "cameron@actuaryconsulting.co.za",
  "Jenny": "jenny@actuaryconsulting.co.za",
  "Yolandie": "yolandie@actuaryspace.co.za",
  "Vanessa": "vanessa@actuaryconsulting.co.za",
  "Yael": "yael@actuaryconsulting.co.za",
  "Cynthia": "cynthia@actuaryconsulting.co.za"
};

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
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivedCards, setArchivedCards] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState(""); // 👈 NEW: Archive Search
  const openArchiveBin = async () => {
    setShowArchiveModal(true);
    setArchivedLoading(true);
    try {
      // 🔗 SYNCED: This specifically matches your filename "trello-archived"
      const res = await fetch("/.netlify/functions/trello-archived");
      const json = await res.json();
      if (json.cards) {
        // 🛠️ DATA MAPPER: Formats raw Trello data to match your UI perfectly
        const mapped = json.cards.map(c => {
           const labelNames = (c.labels || []).map(l => l.name).filter(Boolean);
           
           // Extract the translated custom fields from the new backend
           let badgeArr = labelNames.map(l => ({ text: l, isBottom: false }));
           if (c.parsedCustomFields) {
               if (c.parsedCustomFields.Priority) badgeArr.push({ text: `Priority: ${c.parsedCustomFields.Priority}`, isBottom: true });
               if (c.parsedCustomFields.Status) badgeArr.push({ text: `Status: ${c.parsedCustomFields.Status}`, isBottom: true });
               if (c.parsedCustomFields.Active) badgeArr.push({ text: `Active: ${c.parsedCustomFields.Active}`, isBottom: true });
           }

           return {
              id: c.id,
              title: c.name,
              due: c.due || "",
              labels: labelNames,
              badges: ensureBadgeTypes(badgeArr),
              people: c.idMembers || [],
              listId: c.idList,
              list: "Archived",
              customFields: c.parsedCustomFields || {},
              description: c.desc || "",
              cover: c.cover || null,
              isArchived: true
           };
        });
        setArchivedCards(mapped);
      }
    } catch(err) { console.error("Failed to load archive", err); }
    setArchivedLoading(false);
  };


  // 👇 SWR CACHE: Load instantly from memory so the screen is never empty
  const [trelloBuckets, setTrelloBuckets] = useState(() => {
    try {
      const cached = localStorage.getItem("TRELLO_CACHE");
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });
  const [clientFiles, setClientFiles] = useState([]);

  // ⚡ INSTANT REACTION: Listens to the main app and updates Right Pane in 0ms
  useEffect(() => {
    const handler = (e) => setTrelloBuckets(e.detail);
    window.addEventListener("optimisticRightPane", handler);
    return () => window.removeEventListener("optimisticRightPane", handler);
  }, []);

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

    // Listen for moves/archives from the Middle Panel
    const handlePause = () => { lastMoveTime.current = Date.now(); };
    window.addEventListener("pauseTrelloPolling", handlePause);

    async function fetchTrello(force = false) {
      if (!isMounted) return;

      // 1. SAFETY CHECKS
      if (document.hidden && !force) return; 
      if (dragging && !force) return;
      // Extended to 10 seconds to stop rubber-banding
      if (Date.now() - lastMoveTime.current < 10000 && !force) return;

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
        // Extended to 10 seconds
        if (Date.now() - lastMoveTime.current < 10000 && !force) return;
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
              customFields: (() => {
                 let safeCF = {};
                 for (let k in (c.customFields || {})) {
                    // ⚡ STRICT MAPPING: Prevents the two clocks from overwriting each other
                    if (k === "WorkTimerStart") safeCF.WorkTimerStart = c.customFields[k];
                    else if (k === "WorkDuration") safeCF.WorkDuration = c.customFields[k];
                    else if (k === "TimerStart") safeCF.TimerStart = c.customFields[k];
                    else if (k === "Duration") safeCF.Duration = c.customFields[k];
                    else safeCF[k] = c.customFields[k];
                 }
                 return safeCF;
              })(),
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

        // Broadcast ALL lists (unfiltered) so the Move dropdown has every option
        const allListsRaw = mapped.map(b => ({ id: b.id, title: b.title, cardsLength: b.cards.length }));
        window.dispatchEvent(new CustomEvent("updateAllLists", { detail: allListsRaw }));

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
            
            // 👇 CACHE SAVE: Memorize the latest lists for the next time you open the app
            localStorage.setItem("TRELLO_CACHE", JSON.stringify(mapped));
            
            return mapped;
        });

      } catch (err) {
        console.error("Trello Poll Error:", err);
      }
    }

    // Initial Fetch (Bypass the 8-second cooldown block on first load)
    fetchTrello(true);

    // Poll every 12 seconds (Safe zone for Trello API)
    pollTimer = setInterval(() => fetchTrello(), 12000);

    return () => {
        isMounted = false; 
        clearInterval(pollTimer);
        window.removeEventListener("pauseTrelloPolling", handlePause);
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
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '8px' }}>
        <span>Trello Cards</span>
        <button 
          onClick={openArchiveBin} 
          style={{ background: 'transparent', border: 'none', color: '#9fadbc', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#8993a4'} // 🎨 LIGHT GRAY HOVER
          onMouseLeave={e => e.currentTarget.style.color = '#9fadbc'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.41l.83-1zM5 19V8h14v11H5zm11-5.5l-4 4-4-4 1.41-1.41L11 13.67V10h2v3.67l1.59-1.58L16 13.5z"/></svg>
          Archive Bin
        </button>
      </div>

      {/* ARCHIVE MODAL OVERLAY */}
      {showArchiveModal && (
        <div style={{ position: 'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.6)', zIndex: 9999, display:'grid', placeItems:'center' }} onClick={() => setShowArchiveModal(false)}>
          <div style={{ background: '#f4f5f7', width: '400px', maxHeight: '80vh', borderRadius: '3px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
             
             {/* HEADER */}
             <div style={{ padding: '16px 16px 8px 16px', display: 'flex', justifyContent: 'space-between', color: '#172b4d', fontWeight: 600 }}>
                <span>Archived items</span>
                <button onClick={() => setShowArchiveModal(false)} style={{ background:'none', border:'none', color:'#42526e', cursor:'pointer', fontSize:'16px' }}>✕</button>
             </div>
             
             {/* 🔍 ARCHIVE SEARCH BAR */}
             <div style={{ padding: '0 16px 12px 16px', borderBottom: '1px solid rgba(9,30,66,0.13)' }}>
                <input 
                  type="text" 
                  placeholder="Search archives..." 
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', outline: 'none', fontSize: '13px', color: '#172b4d' }}
                />
             </div>

             <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {archivedLoading ? <div style={{ color: '#5e6c84', textAlign:'center', padding: '20px' }}>Loading archive...</div> :
                  archivedCards.filter(c => c.title.toLowerCase().includes(archiveSearch.toLowerCase())).length === 0 ? <div style={{ color: '#5e6c84', textAlign:'center', padding: '20px' }}>No archived cards found.</div> :
                  archivedCards.filter(c => c.title.toLowerCase().includes(archiveSearch.toLowerCase())).map(c => (
                    <div 
                      key={c.id} 
                      style={{ background: '#ffffff', borderRadius: '3px', padding: '12px', marginBottom: '8px', cursor: 'pointer', position: 'relative', boxShadow: '0 1px 1px rgba(9,30,66,0.25)', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid transparent' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#0079bf'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: c }));
                        setShowArchiveModal(false);
                      }}
                    >
                       <div style={{ color: '#172b4d', fontWeight: 500, fontSize: '14px', paddingRight: '30px', lineHeight: '1.4' }}>
                          {c.title}
                       </div>
                       
                       <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ background: '#ebecf0', padding: '4px 8px', borderRadius: '3px', fontSize: '12px', color: '#42526e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.41l.83-1zM5 19V8h14v11H5zm11-5.5l-4 4-4-4 1.41-1.41L11 13.67V10h2v3.67l1.59-1.58L16 13.5z"/></svg>
                            Archived
                          </span>
                          
                          {(c.badges || []).map((b, k) => (
                            <span key={k} className={`tl-badge ${b.type || "label-default"}`} style={{ padding: '4px 8px', fontSize: '12px' }}>
                              {b.text}
                            </span>
                          ))}
                       </div>

                       <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <div className="tl-people" style={{ margin: 0 }}>
                            {c.people?.map((p, idx) => {
                              const img = avatarFor(p);
                              return img ? <img key={idx} className="av-img" src={img} alt={p} style={{ width: 24, height: 24 }} /> : <div key={idx} className="av" style={{ width: 24, height: 24 }}>{p.slice(0,1)}</div>;
                            })}
                          </div>
                       </div>

                       <button
                         title="Recover"
                         onClick={async (e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new Event("pauseTrelloPolling"));
                            setArchivedCards(prev => prev.filter(x => x.id !== c.id));
                            fetch("/.netlify/functions/trello-restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: c.id }) });
                         }}
                         style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: '#6b778c', cursor: 'pointer', padding: '4px', display: 'grid', placeItems: 'center', transition: 'color 0.2s' }}
                         onMouseEnter={e => e.currentTarget.style.color = '#172b4d'}
                         onMouseLeave={e => e.currentTarget.style.color = '#6b778c'}
                       >
                          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                       </button>
                    </div>
                  ))
                }
             </div>
          </div>
        </div>
      )}
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

const EmailSignature = () => (
  <div style={{ padding: "0 16px 24px 16px", fontFamily: "Verdana, Arial, sans-serif", fontSize: "13px", color: "#3c4043", lineHeight: "1.6", cursor: "default" }}>
    <div style={{ marginBottom: "16px" }}>Kind regards</div>
    <div style={{ color: "#b38f6a", fontWeight: "bold", fontSize: "15px", marginBottom: "16px" }}>Siyabonga Nono</div>
    <div style={{ color: "#b38f6a", marginBottom: "16px" }}>Bsc in Math Science in Actuarial Science</div>
    
    <div style={{ marginBottom: "12px", color: "#5f6368" }}>
      <b style={{ color: "#5f6368" }}>T</b> 011 463 0313 <span style={{ display: "inline-block", width: "8px" }}></span> <b style={{ color: "#5f6368" }}>M</b> 072 689 0562
    </div>
    <div style={{ marginBottom: "12px", color: "#5f6368" }}>
      <b style={{ color: "#5f6368" }}>E</b> <a href="mailto:siyabonga@actuaryconsulting.co.za" style={{ color: "#1a73e8", textDecoration: "none" }}>siyabonga@actuaryconsulting.co.za</a> <span style={{ display: "inline-block", width: "8px" }}></span> <b style={{ color: "#5f6368" }}>W</b> <a href="http://actuaryconsulting.co.za" style={{ color: "#1a73e8", textDecoration: "none" }}>actuaryconsulting.co.za</a>
    </div>
    <div style={{ marginBottom: "20px", color: "#5f6368" }}>
      <b style={{ color: "#5f6368" }}>A</b> Corner 5th &amp; Maude Street, Sandown, Sandton, 2031
    </div>
    
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "32px", color: "#b38f6a", letterSpacing: "1px", lineHeight: "1" }}>ACTUARY</div>
      <div style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px", color: "#5f6368", letterSpacing: "6.5px", marginTop: "6px", marginLeft: "2px" }}>CONSULTING</div>
    </div>
    
    <div style={{ fontSize: "10px", color: "#9aa0a6", lineHeight: "1.5", textAlign: "justify", borderTop: "1px solid #f1f3f4", paddingTop: "12px" }}>
      The information contained in this email is confidential and may be subject to legal privilege. The content of this email, which may include one or more attachments, is strictly confidential, and is intended solely for the use of the named recipient/s. If you are not the intended recipient, you cannot use, copy, distribute, disclose or retain the email or any part of its contents or take any action in reliance on it. If you have received this email in error, please email the sender by replying to this message and to permanently delete it and all attachments from your computer. All reasonable precautions have been taken to ensure that no viruses are present in this email and the company cannot accept responsibility for any loss or damage arising from the use of this email or attachments.
    </div>
 </div>
);

const EmailMetadata = ({ email }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative", marginTop: "2px" }}>
      <div 
        style={{ 
          fontSize: "12px", 
          color: "#5f6368", 
          display: "inline-flex", 
          alignItems: "center", 
          gap: "4px", 
          cursor: "pointer", 
          padding: "2px 4px", 
          marginLeft: "-4px", 
          borderRadius: "4px",
          position: "relative", 
          zIndex: isOpen ? 95 : "auto" 
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        to me <span style={{ fontSize: "10px" }}>{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && (
        <>
          {/* Invisible backdrop to close the menu when clicking outside */}
          <div 
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          
          <div style={{
            position: "absolute",
            top: "100%",
            left: "0",
            marginTop: "4px",
            background: "white",
            border: "1px solid #dadce0",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "16px",
            zIndex: 100,
            minWidth: "480px",
            fontSize: "13px",
            color: "#202124",
            display: "flex",
            flexDirection: "column",
            cursor: "default"
          }}
          onClick={e => e.stopPropagation()} // Prevent clicks inside from closing it
          >
            <div style={{ display: "grid", gridTemplateColumns: "75px 1fr", gap: "8px 12px", alignItems: "baseline" }}>
              <span style={{ color: "#5f6368", textAlign: "right" }}>from:</span>
              <span><strong>{email.fromName}</strong> {email.fromEmail}</span>
              
              <span style={{ color: "#5f6368", textAlign: "right" }}>to:</span>
              <span>{email.to ? email.to.join(", ") : "Siyabonga Nono <siyabonga@actuaryconsulting.co.za>"}</span>
              
              <span style={{ color: "#5f6368", textAlign: "right" }}>date:</span>
              <span>{email.date ? new Date(email.date).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : email.time}</span>
              
              <span style={{ color: "#5f6368", textAlign: "right" }}>subject:</span>
              <span>{email.subject}</span>

              <span style={{ color: "#5f6368", textAlign: "right" }}>mailed-by:</span>
              <span>actuaryconsulting.co.za</span>

              <span style={{ color: "#5f6368", textAlign: "right" }}>signed-by:</span>
              <span>actuaryconsulting.co.za</span>
              
              <span style={{ color: "#5f6368", textAlign: "right" }}>security:</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#5f6368" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                Standard encryption (TLS)
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ---------- app ---------- */
export default function App() {
  const [inputValue, setInputValue] = useState("");
const [searchQuery, setSearchQuery] = useState("");
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
  // ⚡ ZERO-LATENCY ENGINE: Broadcasts Middle Pane changes directly to the Right Pane
  const [trelloBuckets, _setTrelloBuckets] = useState(() => {
    try {
      const cached = localStorage.getItem("TRELLO_CACHE");
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  }); 
  const setTrelloBuckets = (action) => {
      _setTrelloBuckets(prev => {
          const next = typeof action === 'function' ? action(prev) : action;
          window.dispatchEvent(new CustomEvent("optimisticRightPane", { detail: next }));
          return next;
      });
  };

// ⚡ CACHED LISTS: Feeds the Move Menu instantly
  const [allTrelloLists, setAllTrelloLists] = useState(() => {
    try {
      const cached = localStorage.getItem("TRELLO_LISTS_CACHE");
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });
  
  useEffect(() => {
    fetch("/.netlify/functions/trello-lists")
      .then(res => res.json())
      .then(data => {
        if (data.lists) {
          const newLists = data.lists.map(l => ({ id: l.id, title: l.name, cardsLength: 0 }));
          setAllTrelloLists(prev => {
             const merged = newLists.map(nl => {
                 const existing = prev.find(p => p.id === nl.id);
                 return existing ? { ...nl, cardsLength: existing.cardsLength } : nl;
             });
             localStorage.setItem("TRELLO_LISTS_CACHE", JSON.stringify(merged));
             return merged;
          });
        }
      })
      .catch(err => console.error("Failed to fetch lists:", err));

    const handler = e => {
      setAllTrelloLists(prevLists => {
         const activeLists = e.detail; 
         const master = [...prevLists];
         activeLists.forEach(active => {
            const found = master.find(m => m.id === active.id);
            if (found) found.cardsLength = active.cardsLength;
            else master.push(active);
         });
         localStorage.setItem("TRELLO_LISTS_CACHE", JSON.stringify(master));
         return master;
      });
    };
    window.addEventListener("updateAllLists", handler);
    return () => window.removeEventListener("updateAllLists", handler);
  }, []);

// NEW DRAFT POSITION STATE
 const [draftPos, setDraftPos] = useState({ x: 0, y: 0 });
 const isDraggingDraft = useRef(false);
 const draftWindowRef = useRef(null);

 const handleDraftMouseDown = (e) => {
   if (isDraftEnlarged) return;
   e.preventDefault(); // Prevents text highlighting which breaks the drag
   isDraggingDraft.current = true;
   const startX = e.clientX - draftPos.x;
   const startY = e.clientY - draftPos.y;

   let currentX = draftPos.x;
   let currentY = draftPos.y;

   const onMouseMove = (moveEvent) => {
     if (!isDraggingDraft.current) return;
     
     currentX = moveEvent.clientX - startX;
     currentY = moveEvent.clientY - startY;

     // Update the DOM directly to bypass React render lag (0ms latency)
     if (draftWindowRef.current) {
       draftWindowRef.current.style.transform = `translate(${currentX}px, ${currentY}px)`;
     }
   };

   const onMouseUp = () => {
     isDraggingDraft.current = false;
     document.removeEventListener("mousemove", onMouseMove);
     document.removeEventListener("mouseup", onMouseUp);
     
     // Sync back to React state ONLY when dragging stops so it persists
     setDraftPos({ x: currentX, y: currentY });
   };

   document.addEventListener("mousemove", onMouseMove);
   document.addEventListener("mouseup", onMouseUp);
 };

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
    fetch("/.netlify/functions/gchat-react", {
      method: "POST",
      credentials: "include", // 👈 MANDATORY: Attaches Siya's cookie
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

  const handleToggleStar = async (e, msgId, currentStarred) => {
    if (e) {
      e.stopPropagation(); 
      e.preventDefault();  
    }
    
    const nextStarredState = !currentStarred;

    // 1. Optimistic UI Update
    setGmailEmails(prev => prev.map(msg => 
      msg.id === msgId ? { ...msg, isStarred: nextStarredState } : msg
    ));

    try {
      const response = await fetch("/.netlify/functions/gmail-toggle-star", {
        method: "POST",
        credentials: "include", // 👈 ESSENTIAL: Sends auth cookies to backend
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msgId, starred: nextStarredState })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Server rejected request");
      }

      const result = await response.json().catch(() => ({ ok: true }));

      if (result.ok === false) {
        throw new Error(result.error || "Sync failed");
      }

      // If we are in the Starred folder and we unstar something, remove it from view
      if (!nextStarredState && gmailFolder === "STARRED") {
        setGmailEmails(prev => prev.filter(msg => msg.id !== msgId));
      }
    } catch (err) {
      console.error("Starring sync failed:", err);
      // Revert UI to previous state on failure
      setGmailEmails(prev => prev.map(msg => 
        msg.id === msgId ? { ...msg, isStarred: currentStarred } : msg
      ));
      alert(`Gmail could not save this star: ${err.message}`);
    }
  };
  /* WhatsApp */
  const [waChats, setWaChats] = useState(() => buildSeedChats());
  const waBodyRef = useRef(null);


/* Email */
  const [emailIdx, setEmailIdx] = useState(0);
  const [email, setEmail] = useState(EMAIL_THREADS[0]);
  const [emailPreview, setEmailPreview] = useState(null);
  const [showEmailDetails, setShowEmailDetails] = useState(false); // 👈 NEW: Toggles the "to me" dropdown
  /* Gmail Inbox State */
  const [gmailEmails, setGmailEmails] = useState([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState("");
 const [selectedEmailIds, setSelectedEmailIds] = useState(new Set());
const [gmailFolder, setGmailFolder] = useState("INBOX"); // Tracks current folder
  const [gmailRefreshTrigger, setGmailRefreshTrigger] = useState(0); // 👈 NEW: Hard refresh trigger
  const [gmailPage, setGmailPage] = useState(1);
  const [gmailTotal, setGmailTotal] = useState(0); // Tracks total exact emails

// NEW: email draft helper state
 const [showDraftPicker, setShowDraftPicker] = useState(false);
 const [selectedDraftTemplate, setSelectedDraftTemplate] = useState(null);
 const [draftTo, setDraftTo] = useState("");   // 👈 NEW
 const [isDraftEnlarged, setIsDraftEnlarged] = useState(false); // 👈 NEW
 const [draftAttachments, setDraftAttachments] = useState([]); // 👈 NEW: Holds email attachments
 const draftFileInputRef = useRef(null); // 👈 NEW: Reference for the hidden file input


  /* Trello modal */
  const [trelloCard, setTrelloCard] = useState(null);
  const [trelloMenuOpen, setTrelloMenuOpen] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [moveTab, setMoveTab] = useState("outbox");
  const [moveTargetList, setMoveTargetList] = useState("");
  const [moveTargetPos, setMoveTargetPos] = useState(1);
  const [moveListSearch, setMoveListSearch] = useState(""); // 👈 NEW: Tracks search text
  
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
      const { text, cardId, icon, alt, spaceId, driveEmail, gmailData, timestamp } = e.detail || {};
      
      if (!text) return;

      const unique = `${cardId || spaceId || "noid"}-${nextIdRef.current++}`;
      
      // 👇 FIX: Use the actual email/message timestamp instead of the current polling time
      let eventDate = new Date();
      if (gmailData && gmailData.date) {
         eventDate = new Date(gmailData.date);
      } else if (timestamp) {
         eventDate = new Date(timestamp);
      }

      const item = {
        id: `nt-${unique}`,
        // 👇 CHANGED: Use passed values or fallback to Trello defaults
        alt: alt || "Trello",
        icon: icon || trelloIcon,
        text,
        time: formatUKTimeWithSeconds(eventDate),
        cardId,
        spaceId,     // For Google Chat
        driveEmail,  // For Gmail
        gmailData,   // Add this so clicking the notification opens the email correctly
      };
      
      setNotifications((prev) => [item, ...prev].slice(0, 200));
    };
    
    window.addEventListener("notify", onNotify);
    return () => window.removeEventListener("notify", onNotify);
  }, []);

  // 1. GLOBAL IDENTITY LOADER (Runs once on mount, regardless of view)
useEffect(() => {
    async function fetchWhoAmI() {
      const stored = localStorage.getItem("GCHAT_ME");
      if (stored) setGchatMe(stored);

      try {
        const res = await fetch("/.netlify/functions/gchat-whoami", {
          credentials: "include" 
        });

        // 🛡️ If the response is 401 or 500, we don't try to parse it as a valid user
        if (!res.ok) {
          if (res.status === 401) console.log("User is not authenticated yet.");
          return; 
        }

        const json = await res.json().catch(() => ({}));
        const myId = json.name || json.user?.name || json.resourceName;

        if (myId) {
          console.log("identified current user as:", myId);
          setGchatMe(myId);
          localStorage.setItem("GCHAT_ME", myId);
        }
      } catch (err) {
        console.warn("Silent Auth Check:", err.message);
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

        // 🛡️ Added credentials: "include" so the sidebar can load using your cookie
        const res = await fetch("/.netlify/functions/gchat-spaces", {
          credentials: "include"
        });
        
        const json = await res.json().catch(() => ({}));

        if (!res.ok || json.ok !== true) {
          throw new Error(json?.error || `Failed to load spaces (HTTP ${res.status})`);
        }

        if (!cancelled) {
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

      // 🛡️ Added credentials: "include" so the poll can see Siya's Master Key (cookie)
      const res = await fetch(
        `/.netlify/functions/gchat-messages?space=${encodeURIComponent(
          gchatSelectedSpace.id
        )}`, 
        { credentials: "include" }
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
        setGchatMessages((prev) => dedupeMergeMessages(prev, incoming));

        setReactions((prev) => {
          const next = { ...prev };
          incoming.forEach((msg) => {
            if (msg.reactions && Array.isArray(msg.reactions)) {
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
          // 🛡️ Added credentials: "include" so background discovery can see Siya's cookie
          const res = await fetch("/.netlify/functions/gchat-spaces", { credentials: "include" });
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
        // 🛡️ Added credentials: "include" so the background alert knows it is Siya asking for messages
        const res = await fetch(
          `/.netlify/functions/gchat-messages?space=${encodeURIComponent(targetSpaceId)}`,
          { credentials: "include" }
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
        const res = await fetch("/.netlify/functions/gmail-inbox?limit=50");
        const json = await res.json().catch(() => ({}));
        
        if (!json.ok || !Array.isArray(json.emails)) return;

       // 1. FIRST RUN: Memorize inbox AND trigger notifications for UNREAD emails
        if (seenGmailIdsRef.current === null) {
          seenGmailIdsRef.current = new Set(json.emails.map(e => e.id));
          
          // Reverse the array so the absolute newest emails are processed LAST, 
          // placing them at the very top of the notification stack.
          [...json.emails].reverse().forEach(email => {
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
        // Reverse here as well to ensure batch arrivals stack chronologically
        [...json.emails].reverse().forEach(email => {
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
        // Updated to pass current page number to the backend
        const res = await fetch(`/.netlify/functions/gmail-inbox?folder=${gmailFolder}&limit=50&page=${gmailPage}`);
        const json = await res.json().catch(() => ({}));

       if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

        if (!cancelled) {
          setGmailEmails(json.emails || []);
          setGmailTotal(json.total || 0);
        }
      } catch (err) {
        if (!cancelled) setGmailError(String(err.message || err));
      } finally {
        if (!cancelled) setGmailLoading(false);
      }
    }

    loadInbox();
    return () => { cancelled = true; };
  }, [currentView.app, gmailFolder, gmailRefreshTrigger, gmailPage]); // 👈 Added gmailPage dependency

 
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
                  activity: [],
                  isArchived: e.detail.isArchived || false // <-- THIS IS THE FIX
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
      setShowMoveSubmenu(false); // <--- THIS IS THE NEW LINE
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
      _setTrelloBuckets(e.detail); // 🤫 Use _set to avoid echoing back to RightPanel
    }
    window.addEventListener("trelloPolled", handlePoll);
    return () => window.removeEventListener("trelloPolled", handlePoll);
  }, []);

  // 2. MIDDLE PANE: INSTANT UPDATE LISTENER (Fixes 10s delay)
  useEffect(() => {
    function handlePatch(e) {
      const { cardId, updater } = e.detail;
      _setTrelloBuckets(prevBuckets => { // 🤫 Use _set to avoid echoing back to RightPanel
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

   // UPDATED SNIPPET
    // 📧 Real Gmail Inbox Handler
    if (n.alt === "Gmail" && n.gmailData) {
      const msg = n.gmailData;
      
      // 1. Mark as read immediately in the UI
      setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isUnread: false } : e));
      
      // 2. Parse the sender info
      const fromParts = msg.from ? msg.from.split("<") : ["Unknown", ""];
      const fromName = fromParts[0].replace(/"/g, '').trim();
      const fromEmail = fromParts[1] ? "<" + fromParts[1] : "";
      
      // 3. Handle HTML vs Plain Text parsing
      const isHtml = /<(html|body|div|p|br|b|strong|i|em|a|span|table|style)[^>]*>/i.test(msg.body || "");
      let rawBody = msg.body || msg.snippet || "";
      
      if (!isHtml && rawBody.split('\n').length < 4) {
        rawBody = rawBody
          .replace(/(---------- Forwarded message ---------)/gi, '\n\n$1\n')
          .replace(/(From:|Date:|Subject:|To:|Cc:)/g, '\n$1')
          .replace(/(Dear\s+[A-Za-z]+|Hi\s+[A-Za-z]+|Good\s+day)/gi, '\n\n$1\n\n')
          .replace(/(Kind\s+Regards|Regards|Sincerely|Thank\s+you)/gi, '\n\n$1\n')
          .replace(/(On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^:]+wrote:)/gi, '\n\n$1\n')
          .replace(/(>\s*>)/g, '>>')
          .replace(/(>\s+)/g, '\n$1')
          .replace(/(\s\d+\.)/g, '\n$1')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      // 4. Set the email state and switch the view
      setEmail({
        id: msg.id, subject: msg.subject, fromName, fromEmail,
        date: msg.date,
        time: new Date(msg.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        body: isHtml ? "" : rawBody,
        bodyHtml: isHtml ? msg.body : "",
        attachments: msg.attachments ? msg.attachments.map(a => ({
          ...a,
          type: a.mimeType.includes("pdf") ? "pdf" : a.mimeType.includes("image") ? "img" : a.mimeType.includes("spreadsheet") || a.mimeType.includes("excel") ? "xls" : "file",
          url: `/.netlify/functions/gmail-download?messageId=${msg.id}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}`
        })) : [],
        actions: [{ key: "submit_trello", label: "Submit to Trello" }, { key: "update_tracker", label: "Update AC Tracker" }]
      });
      
      setEmailPreview(null);
      setCurrentView({ app: "email", contact: null }); // Switch to individual email view
      dismissNotification(n); // This handles the backend 'mark as read' ping automatically
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
        credentials: "include", // 👈 MANDATORY: Attaches Siya's cookie
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail.trim() })
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (json.ok && json.space) {
        const newSpace = { ...json.space, id: json.space.name };

        setGchatDmNames(prev => ({ ...prev, [newSpace.id]: targetEmail.trim() }));

        setGchatSpaces(prev => {
          const exists = prev.find(s => s.id === newSpace.id);
          return exists ? prev : [newSpace, ...prev];
        });

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
                credentials: "include", // 👈 MANDATORY
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
                reject(); 
                return;
              }
              
              resolve(); 
            } catch (e) {
              console.error("Reader/Fetch error:", e);
              reject();
            }
          };
        });

        setPendingUpload(null);

      } else {
        // --- TEXT ONLY FLOW ---
        const res = await fetch("/.netlify/functions/gchat-send", {
          method: "POST",
          credentials: "include", // 👈 MANDATORY
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            space: gchatSelectedSpace.id,
            text,
          }),
        });
        json = await res.json().catch(() => ({}));
      }

      if (json.ok && json.message) {
        const me = json.message?.sender?.name;
        if (me && !gchatMe) {
          setGchatMe(me);
          localStorage.setItem("GCHAT_ME", me);
        }
        setGchatMessages((prev) => dedupeMergeMessages(prev, [json.message]));
        setInputValue(""); 
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
    // SAFE FILTER LOGIC
    let rawQ = (searchQuery || "").toLowerCase().trim();
    let searchTerms = [];
    
    if (rawQ.startsWith('"') && rawQ.endsWith('"') && rawQ.length > 1) {
      searchTerms = [rawQ.slice(1, -1)]; // Exact phrase match
    } else {
      searchTerms = rawQ.split(/\s+/).filter(Boolean); // Multi-word ANY match
    }
    
    const filteredEmails = (gmailEmails || []).filter(e => {
      if (searchTerms.length === 0) return true;
      const subject = (e.subject || "").toLowerCase();
      const from = (e.from || "").toLowerCase();
      const snippet = (e.snippet || "").toLowerCase();
      const combined = `${subject} ${from} ${snippet}`;
      return searchTerms.every(term => combined.includes(term));
    });

    const filteredGchatSpaces = (gchatSpaces || []).filter(s => {
      if (searchTerms.length === 0) return true;
      const learnedName = gchatDmNames[s.id] || "";
      const title = (s.type === "DIRECT_MESSAGE" 
        ? (learnedName || s.displayName || "Direct Message") 
        : (s.displayName || "Unnamed")).toLowerCase();
      return searchTerms.every(term => title.includes(term));
    });

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
    const allSelected = (filteredEmails || []).length > 0 && selectedEmailIds.size === filteredEmails.length;

    const toggleSelectAll = () => {
      if (allSelected) setSelectedEmailIds(new Set());
      else setSelectedEmailIds(new Set(filteredEmails.map(e => e.id)));
    };

    const handleDeleteSelected = async () => {
      const snapshotIds = Array.from(selectedEmailIds);
      if (snapshotIds.length === 0) return;
      
      const isPerm = gmailFolder === "TRASH";
      const confirmText = isPerm 
        ? `Permanently delete ${snapshotIds.length} item(s)?` 
        : `Move ${snapshotIds.length} item(s) to Trash?`;
      
      if (!window.confirm(confirmText)) return;
      
      setGmailLoading(true);
      
      try {
        const bulkResponse = await fetch("/.netlify/functions/gmail-delete-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: snapshotIds, permanent: isPerm })
        });

        const bulkResult = await bulkResponse.json().catch(() => ({ ok: bulkResponse.ok }));

        if (bulkResponse.ok && bulkResult.ok) {
          setSelectedEmailIds(new Set());
          setGmailEmails([]); 
          setGmailRefreshTrigger(p => p + 1);
          
          window.dispatchEvent(new CustomEvent("notify", { 
            detail: { 
              text: isPerm ? "Permanently deleted" : "Moved to Trash", 
              alt: "Gmail", 
              icon: gmailIcon 
            } 
          }));
        } else {
          setGmailLoading(false);
          alert(`Error: ${bulkResult.error || "Server failed to process request"}`);
        }
      } catch (e) { 
        console.error("Delete handler error:", e);
        setGmailLoading(false);
        alert("Action failed. Please check your connection and try again.");
      }
    };

    return (
            <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", background: "#fff", borderRadius: "12px", border: "1px solid #e6e6e6", overflow: "hidden" }}>
              
              {/* 🟢 TOP ROW: COMPOSE + SEARCH BAR */}
              <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "16px" }}>
                <button 
                  className="btn blue" 
                  onClick={() => {
                    setEmail(null);
                    setEmailPreview(null);
                    setSelectedDraftTemplate({ ...DRAFT_TEMPLATES.find(t => t.id === "new_blank") });
                    setDraftTo("");
                    setDraftAttachments([]);
                  }}
                  style={{ 
                    borderRadius: "16px", 
                    padding: "10px 24px", 
                    fontSize: "14px", 
                    fontWeight: 500, 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px",
                    background: "#c2e7ff", 
                    color: "#001d35",
                    border: "none",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                    flexShrink: 0
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                  Compose
                </button>

                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search in mail..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 44px",
                      borderRadius: "24px",
                      border: "none",
                      fontSize: "15px",
                      outline: "none",
                      background: "#f1f3f4"
                    }}
                  />
                  <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#5f6368" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
              </div>

              {/* 🟢 SECOND ROW: SELECT ALL + NAV PILLS + PAGINATION */}
              <div style={{ padding: "8px 16px", borderBottom: "1px solid #eee", background: "#fff", display: "flex", alignItems: "center", minHeight: "48px", gap: "16px" }}>
                
                {/* 1. Select All Box (Width fixed at 40px to align with list checkboxes) */}
                <div style={{ display: "flex", alignItems: "center", width: "40px", justifyContent: "center", flexShrink: 0 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: "pointer", width: "18px", height: "18px" }} />
                </div>

                {/* 2. Navigation Pills Group */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {/* INBOX */}
                  <button
                    onClick={() => { setGmailFolder("INBOX"); setGmailPage(1); setGmailEmails([]); setSelectedEmailIds(new Set()); }}
                    style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "INBOX" ? "#c2e7ff" : "transparent", color: gmailFolder === "INBOX" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    {gmailFolder === "INBOX" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.44 2s2.75-.81 3.44-2H19v3zm0-5h-4.99c0 1.1-.9 2-2 2s-2-.9-2-2H5V5h14v9z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>}
                    <span>Inbox</span>
                  </button>

                  {/* STARRED */}
                  <button
                    onClick={() => { setGmailFolder("STARRED"); setGmailPage(1); setGmailEmails([]); setSelectedEmailIds(new Set()); }}
                    style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "STARRED" ? "#c2e7ff" : "transparent", color: gmailFolder === "STARRED" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    {gmailFolder === "STARRED" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>}
                    <span>Starred</span>
                  </button>

                  {/* SENT */}
                  <button
                    onClick={() => { setGmailFolder("SENT"); setGmailPage(1); setGmailEmails([]); setSelectedEmailIds(new Set()); }}
                    style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "SENT" ? "#c2e7ff" : "transparent", color: gmailFolder === "SENT" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    {gmailFolder === "SENT" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
                    <span>Sent</span>
                  </button>

                  {/* DRAFTS */}
                  <button
                    onClick={() => { setGmailFolder("DRAFTS"); setGmailPage(1); setGmailEmails([]); setSelectedEmailIds(new Set()); }}
                    style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "DRAFTS" ? "#c2e7ff" : "transparent", color: gmailFolder === "DRAFTS" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    {gmailFolder === "DRAFTS" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>}
                    <span>Drafts</span>
                  </button>

                  {/* TRASH */}
                  <button
                    onClick={() => { setGmailFolder("TRASH"); setGmailPage(1); setGmailEmails([]); setSelectedEmailIds(new Set()); }}
                    style={{ height: "32px", padding: "0 16px", borderRadius: "100px", fontSize: "14px", fontWeight: 500, cursor: "pointer", background: gmailFolder === "TRASH" ? "#c2e7ff" : "transparent", color: gmailFolder === "TRASH" ? "#001d35" : "#444746", border: "none", display: "flex", alignItems: "center", gap: "10px" }}
                  >
                    {gmailFolder === "TRASH" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>}
                    <span>Trash</span>
                  </button>
                </div>

                {/* 3. Bulk Action Buttons (Only show when selected) */}
                {selectedEmailIds.size > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", borderLeft: "1px solid #dadce0", paddingLeft: "16px" }}>
                    <button 
                      onClick={handleDeleteSelected} 
                      title={gmailFolder === "TRASH" ? "Delete permanently" : "Move to Trash"}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", padding: "6px", borderRadius: "50%", display: "grid", placeItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                  </div>
                )}

                {/* 4. Pagination (Pinned to right) */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#5f6368", fontSize: "13px", marginLeft: "auto", marginRight: "4px" }}>
                  <span>{`${gmailTotal > 0 ? (gmailPage - 1) * 50 + 1 : 0}–${Math.min(gmailPage * 50, gmailTotal)} of ${gmailTotal.toLocaleString()}`}</span>
                  <div style={{ display: "flex" }}>
                    <button onClick={() => { setGmailEmails([]); setGmailPage(p => Math.max(1, p - 1)); }} disabled={gmailPage === 1} style={{ background: "transparent", border: "none", cursor: gmailPage === 1 ? "default" : "pointer", color: gmailPage === 1 ? "#c1c7d0" : "#5f6368", padding: "4px", borderRadius: "50%" }} onMouseEnter={e => gmailPage !== 1 && (e.currentTarget.style.background = "#eee")} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </button>
                    <button onClick={() => { setGmailEmails([]); setGmailPage(p => p + 1); }} disabled={gmailPage * 50 >= gmailTotal} style={{ background: "transparent", border: "none", cursor: gmailPage * 50 >= gmailTotal ? "default" : "pointer", color: gmailPage * 50 >= gmailTotal ? "#c1c7d0" : "#5f6368", padding: "4px", borderRadius: "50%" }} onMouseEnter={e => gmailPage * 50 < gmailTotal && (e.currentTarget.style.background = "#eee")} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </button>
                  </div>
                </div>
              </div>

     {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
          {gmailLoading && <div style={{ padding: "16px", color: "#5f6368" }}>Loading inbox...</div>}
          {gmailError && <div style={{ padding: "16px", color: "#ea4335" }}>Error: {gmailError}</div>}
          
          {!gmailLoading && !gmailError && filteredEmails.length === 0 && (
            <div style={{ padding: "16px", color: "#5f6368", textAlign: "center", marginTop: "20px" }}>No matching emails found.</div>
          )}

{!gmailLoading && !gmailError && filteredEmails.map((msg, i) => (
            <div 
              key={msg.id || i}
              style={{ 
                display: "flex", 
                padding: "10px 16px", 
                borderBottom: "1px solid #f1f3f4",
                cursor: "pointer",
                background: selectedEmailIds.has(msg.id) ? "#e8f0fe" : (msg.isUnread ? "#ffffff" : "#f2f6fc"),
                fontWeight: msg.isUnread ? 700 : 400,
                alignItems: "center",
                gap: "12px",
                fontSize: "14px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = "inset 1px 0 0 #dadce0, inset -1px 0 0 #dadce0, 0 1px 2px 0 rgba(60,64,67,.3)"}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
              onClick={() => {
                setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isUnread: false } : e));
                if (msg.isUnread) {
                  fetch("/.netlify/functions/gmail-mark-read", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId: msg.id })
                  }).catch(err => console.error("Mark read failed", err));
                }
                const fromParts = msg.from ? msg.from.split("<") : ["Unknown", ""];
                const fromName = fromParts[0].replace(/"/g, '').trim();
                const fromEmail = fromParts[1] ? "<" + fromParts[1] : "";
                
                // Smarter HTML detection to prevent stripping plain text spacing
                const isHtml = /<(html|body|div|p|br|b|strong|i|em|a|span|table|style)[^>]*>/i.test(msg.body || "");
                
                // Reconstruct newlines if the backend compressed the plain text into a blob
                let rawBody = msg.body || msg.snippet || "";
                if (!isHtml && rawBody.split('\n').length < 4) {
                  rawBody = rawBody
                    .replace(/(---------- Forwarded message ---------)/gi, '\n\n$1\n')
                    .replace(/(From:|Date:|Subject:|To:|Cc:)/g, '\n$1')
                    .replace(/(Dear\s+[A-Za-z]+|Hi\s+[A-Za-z]+|Good\s+day)/gi, '\n\n$1\n\n')
                    .replace(/(Kind\s+Regards|Regards|Sincerely|Thank\s+you)/gi, '\n\n$1\n')
                    .replace(/(On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^:]+wrote:)/gi, '\n\n$1\n')
                    .replace(/(>\s*>)/g, '>>')
                    .replace(/(>\s+)/g, '\n$1')
                    .replace(/(\s\d+\.)/g, '\n$1')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                }

               setEmail({
                  id: msg.id, subject: msg.subject, fromName, fromEmail,
                  date: msg.date,
                  time: new Date(msg.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
                  body: isHtml ? "" : rawBody,
                  bodyHtml: isHtml ? msg.body : "",
                  attachments: msg.attachments ? msg.attachments.map(a => ({
                    ...a,
                    type: a.mimeType.includes("pdf") ? "pdf" : a.mimeType.includes("image") ? "img" : a.mimeType.includes("spreadsheet") || a.mimeType.includes("excel") ? "xls" : "file",
                    url: `/.netlify/functions/gmail-download?messageId=${msg.id}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}`
                  })) : [],
                  actions: [{ key: "submit_trello", label: "Submit to Trello" }, { key: "update_tracker", label: "Update AC Tracker" }]
                });
                setEmailPreview(null);
                setShowEmailDetails(false); // 👈 Closes the dropdown for the next email
                setCurrentView({ app: "email", contact: null });
              }}
            >
              {/* Checkbox Container */}
              <div 
                style={{ padding: "0 4px", display: "flex", alignItems: "center" }}
                onClick={(e) => {
                  e.stopPropagation(); 
                  setSelectedEmailIds(prev => {
                    const next = new Set(prev);
                    if (next.has(msg.id)) next.delete(msg.id);
                    else next.add(msg.id);
                    return next;
                  });
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedEmailIds.has(msg.id)} 
                  readOnly 
                  style={{ cursor: "pointer", width: "16px", height: "16px" }} 
                />
              </div>

              {/* ⭐ STAR ICON CONTAINER */}
              <div 
                style={{ 
                  padding: "0 8px", 
                  display: "flex", 
                  alignItems: "center", 
                  cursor: "pointer",
                  fontSize: "20px",
                  zIndex: 10, /* Ensures it sits above the row background */
                  color: msg.isStarred ? "#f2d600" : "#c1c7d0",
                  transition: "transform 0.1s ease"
                }}
                onClick={(e) => handleToggleStar(e, msg.id, msg.isStarred)}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                {msg.isStarred ? "★" : "☆"}
              </div>
              {/* Sender Name */}
              <div style={{ width: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#202124" }}>
                {msg.from ? msg.from.split("<")[0].replace(/"/g, '').trim() : "(Unknown)"}
              </div>

             {/* Subject, Snippet, and Attachments */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: "#202124", marginRight: "6px" }}>{msg.subject}</span>
                  <span style={{ color: "#5f6368", fontWeight: 400 }}>- {msg.snippet}</span>
                </div>
                
              {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', overflow: 'hidden', alignItems: 'center' }}>
                    {msg.attachments.slice(0, 3).map(att => {
                      const isPdf = att.mimeType.includes('pdf');
                      const isImg = att.mimeType.includes('image');
                      const isXls = att.mimeType.includes('excel') || att.mimeType.includes('spreadsheet');
                      const isWord = att.mimeType.includes('word') || att.mimeType.includes('document');
                      
                      const iconColor = isPdf ? '#ea4335' : isImg ? '#a142f4' : isXls ? '#188038' : isWord ? '#1a73e8' : '#5f6368';
                      const iconBg = isPdf ? '#fce8e6' : isImg ? '#f3e8fd' : isXls ? '#e6f4ea' : isWord ? '#e8f0fe' : '#f1f3f4';
                      const iconText = isPdf ? 'PDF' : isImg ? 'IMG' : isXls ? 'XLS' : isWord ? 'W' : 'FILE';
                      
                      return (
                        <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid #dadce0', borderRadius: '100px', fontSize: '12px', background: '#fff', maxWidth: '180px' }}>
                          <div style={{ background: iconBg, color: iconColor, borderRadius: '4px', padding: '2px 4px', fontSize: '9px', fontWeight: 'bold', display: 'grid', placeItems: 'center', minWidth: '22px' }}>
                            {iconText}
                          </div>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#3c4043', fontWeight: 500 }}>{att.name}</span>
                        </div>
                      )
                    })}
                    {msg.attachments.length > 3 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 10px', border: '1px solid #dadce0', borderRadius: '100px', fontSize: '12px', background: '#fff', color: '#5f6368', fontWeight: 500 }}>
                        +{msg.attachments.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>

              
{/* Date */}
              <div style={{ width: "80px", textAlign: "right", fontSize: "12px", color: msg.isUnread ? "#1a73e8" : "#5f6368" }}>
                {msg.date ? (() => {
                  const d = new Date(msg.date);
                  const now = new Date();
                  const isToday = d.getDate() === now.getDate() && 
                                  d.getMonth() === now.getMonth() && 
                                  d.getFullYear() === now.getFullYear();
                  return isToday 
                    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                })() : ""}
              </div>
            </div>
          ))}
        </div>

{/* 🔽 COMPOSE EDITOR (Floating over Inbox) 🔽 */}
        {selectedDraftTemplate && !email && (
          <div 
            ref={draftWindowRef}
            style={{
            position: "absolute", 
            bottom: "0", 
            right: "24px",
            zIndex: 1000, 
            border: "1px solid #dadce0", 
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            background: "#fff", 
            borderTopLeftRadius: "12px", 
            borderTopRightRadius: "12px", 
            display: "flex", 
            flexDirection: "column", 
            overflow: "hidden",
            width: isDraftEnlarged ? "calc(100% - 48px)" : "500px",
            height: isDraftEnlarged ? "calc(100% - 48px)" : "560px", /* Fixed height stops it from floating too high */
            transform: isDraftEnlarged ? "none" : `translate(${draftPos.x}px, ${draftPos.y}px)`,
            transition: "width 0.15s ease-out, height 0.15s ease-out" /* Smooth size animations, no transform transitions to prevent drag lag */
          }}>
            {/* Draggable Header */}
            <div 
              style={{ padding: "10px 16px", background: "#f2f6fc", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: isDraftEnlarged ? "default" : "move", userSelect: "none" }}
              onMouseDown={handleDraftMouseDown}
            >
              <span style={{ fontWeight: 600, color: "#1f1f1f", fontSize: "14px" }}>New Message</span>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button 
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setIsDraftEnlarged(prev => !prev); 
                    setDraftPos({x:0, y:0}); 
                    if (draftWindowRef.current) draftWindowRef.current.style.transform = "none";
                  }} 
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5f6368", display: "flex", alignItems: "center" }} 
                  title={isDraftEnlarged ? "Minimize" : "Maximize"}
                >
                  {isDraftEnlarged ? (
                    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                  )}
                </button>
              <button 
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setSelectedDraftTemplate(null); setDraftPos({x:0, y:0}); setDraftAttachments([]); }} 
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "16px", color: "#5f6368" }}
                >
                  ✕
                </button>
              </div>
            </div>
            
         {/* To Field with Suggestions */}
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #f1f3f4", display: "flex", alignItems: "center", position: "relative" }}>
              <span style={{ color: "#5f6368", fontSize: "14px", width: "40px" }}>To</span>
              <input
                type="text"
                autoFocus
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "#202124" }}
              />
              
              {/* Suggestion Dropdown */}
              {draftTo.length > 1 && !draftTo.includes("@") && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: "56px",
                  right: "16px",
                  background: "white",
                  border: "1px solid #dadce0",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 2000,
                  maxHeight: "200px",
                  overflowY: "auto",
                  borderRadius: "4px"
                }}>
                  {Object.entries(AC_EMAIL_MAP)
                    .filter(([name]) => name.toLowerCase().includes(draftTo.toLowerCase()))
                    .map(([name, email]) => (
                      <div 
                        key={email}
                        onClick={() => setDraftTo(email)}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f1f3f4"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px"
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        <span style={{ color: "#5f6368" }}>{email}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

{/* Subject Field */}
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #f1f3f4", display: "flex", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Subject"
                defaultValue=""
                id="compose-subject"
                style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "#202124", fontWeight: 500 }}
              />
            </div>

            {/* ATTACHMENT PREVIEW ROW */}
            {draftAttachments.length > 0 && (
              <div style={{ padding: "8px 16px", borderBottom: "1px solid #f1f3f4", display: "flex", gap: "8px", flexWrap: "wrap", background: "#f8f9fa" }}>
                {draftAttachments.map((file, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #dadce0", borderRadius: "16px", padding: "4px 10px", fontSize: "12px", color: "#3c4043" }}>
                    <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                    <span style={{ color: "#5f6368" }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                    <button 
                      onClick={() => setDraftAttachments(prev => prev.filter((_, i) => i !== idx))} 
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 2px", color: "#5f6368", display: "flex", alignItems: "center" }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

        {/* Body Container (Scrolls together with Signature) */}
            <div style={{ flex: 1, overflowY: "auto", background: "#fff", display: "flex", flexDirection: "column" }}>
              <textarea
                className="email-draft-textarea"
                value={selectedDraftTemplate.body}
                onChange={(e) => setSelectedDraftTemplate((prev) => prev ? { ...prev, body: e.target.value } : prev)}
                style={{ 
                  border: "none", 
                  padding: "16px", 
                  resize: "none", 
                  outline: "none", 
                  minHeight: "200px", 
                  fontSize: "14px", 
                  fontFamily: "Verdana, sans-serif",
                  background: "transparent",
                  flexShrink: 0
                }}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
              />
              <EmailSignature />
            </div>
        {/* Footer */}
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  className="btn blue"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    if (!draftTo.trim()) {
                      setEmail((prev) => prev ? { ...prev, systemNote: "Please add a recipient address." } : prev);
                      return;
                    }
                    btn.disabled = true;
                    try {
                      const base64Attachments = await Promise.all(draftAttachments.map(file => {
                        return new Promise((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve({
                            filename: file.name,
                            mimeType: file.type || "application/octet-stream",
                            content: reader.result.split(',')[1]
                          });
                          reader.readAsDataURL(file);
                        });
                      }));

                      const res = await fetch("/.netlify/functions/gmail-send-email", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          to: draftTo,
                          subject: document.getElementById("compose-subject")?.value || "New Message",
                          body: selectedDraftTemplate.body,
                          attachments: base64Attachments 
                        }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
                      
                      window.dispatchEvent(new CustomEvent("notify", { detail: { text: `Email sent to: ${draftTo}`, alt: "Gmail", icon: gmailIcon } }));
                      setSelectedDraftTemplate(null);
                      setDraftTo("");
                      setDraftAttachments([]);
                    } catch (err) {
                      setEmail((prev) => prev ? { ...prev, systemNote: `Error: ${err.message}` } : prev);
                      btn.disabled = false;
                    }
                  }}
                  style={{ background: "#0b57d0", color: "#fff", padding: "8px 24px", borderRadius: "24px", border: "none", fontWeight: 500, cursor: "pointer" }}
                >
                  Send
                </button>
{/* 💾 SAVE AS DRAFT BUTTON */}
                <button
                  title="Save to Drafts"
                  type="button"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    const subjElement = document.getElementById("compose-subject");
                    const currentSubject = subjElement ? subjElement.value : "(No Subject)";
                    
                    btn.disabled = true;
                    try {
                      const res = await fetch("/.netlify/functions/gmail-save-draft", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                          to: draftTo, 
                          subject: currentSubject, 
                          body: selectedDraftTemplate?.body || "" 
                        })
                      });
                      
                      let json;
                      try {
                        json = await res.json();
                      } catch (parseErr) {
                        json = { ok: false, error: "Response was not valid JSON" };
                      }

                      if (res.ok && json.ok) {
                        window.dispatchEvent(new CustomEvent("notify", { 
                          detail: { text: "Draft saved successfully", alt: "Gmail", icon: gmailIcon } 
                        }));

                        if (gmailFolder === "DRAFTS") {
                          setGmailEmails([]); 
                          setGmailRefreshTrigger(prev => prev + 1);
                        }

                        setSelectedDraftTemplate(null);
                        setDraftTo("");
                        setDraftAttachments([]);
                      } else {
                        alert("Error: " + (json.error || "Save failed"));
                        btn.disabled = false;
                      }
                    } catch (err) {
                      console.error("Save Draft Error:", err);
                      alert("Network error: Could not reach the draft server.");
                      btn.disabled = false;
                    }
                  }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", display: "grid", placeItems: "center", padding: "8px", borderRadius: "50%" }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = "#f1f3f4"}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                </button>

                <button 
                  onClick={() => draftFileInputRef.current?.click()} 
                  title="Attach files"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", display: "grid", placeItems: "center", padding: "8px", borderRadius: "50%" }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = "#f1f3f4"}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-3.31-2.69-6-6-6S3 1.69 3 5v11.5c0 3.86 3.14 7 7 7s7-3.14 7-7V6h-1.5z"/></svg>
                </button>
                <input 
                  type="file" 
                  multiple 
                  ref={draftFileInputRef} 
                  style={{ display: "none" }} 
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const validFiles = files.filter(f => f.size <= 4.5 * 1024 * 1024);
                    if (validFiles.length < files.length) alert("Some files were skipped because they exceed the 4.5MB limit.");
                    setDraftAttachments(prev => [...prev, ...validFiles]);
                    e.target.value = "";
                  }} 
                />
              </div>

              <button onClick={() => { setSelectedDraftTemplate(null); setDraftTo(""); setDraftAttachments([]); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5f6368" }}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zM9 8h2v9H9zm4 0h2v9h-2z"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

      if (currentView.app === "email") {
      const att = (email && email.attachments) || [];
      const actions = (email && email.actions) || [];
    

  const handleDeleteEmail = async (id) => {
        if (!window.confirm("Delete this message?")) return;
        try {
          await fetch("/.netlify/functions/gmail-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: id })
          });
          setGmailEmails(prev => prev.filter(e => e.id !== id));
          setCurrentView({ app: "gmail", contact: null });
        } catch (err) {
          console.error("Delete failed", err);
        }
      };
      const handleToggleStar = async (e, msgId, currentStarred) => {
    if (e) e.stopPropagation(); // 🛡️ Hard stop to prevent opening the email
    const newStarred = !currentStarred;

    // 1. INSTANT UI UPDATE: Make it yellow immediately
    setGmailEmails(prev => prev.map(msg => 
      msg.id === msgId ? { ...msg, isStarred: newStarred } : msg
    ));

    try {
      // 2. Backend Sync
      const response = await fetch("/.netlify/functions/gmail-toggle-star", {
        method: "POST",
        credentials: "include", // 👈 THIS MUST BE PRESENT
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msgId, starred: nextStarredState })
      });

      // ⚡ STATUS-FIRST CHECK: If the server says 200 OK, the star IS saved.
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // 🛡️ Silent catch for JSON parsing to prevent the error popup on success
      const result = await response.json().catch(() => ({ ok: true }));

      if (result.ok === false) {
        throw new Error(result.error || "Sync failed");
      }

      if (!nextStarredState && gmailFolder === "STARRED") {
        setGmailEmails(prev => prev.filter(msg => msg.id !== msgId));
      }

    } catch (err) {
      console.error("Failed to toggle star:", err);
      // Revert UI if the network/API failed
      setGmailEmails(prev => prev.map(msg => 
        msg.id === msgId ? { ...msg, isStarred: currentStarred } : msg
      ));
    }
  };

   const emailPane = (
        <div className="email-pane" style={{ border: "none", boxShadow: "none", padding: "8px 24px", background: "#fff" }}>
       {/* Top Gmail Action Bar */}
          <div className="gmail-action-bar" style={{ padding: "8px 0", borderBottom: "none" }}>
            <div className="gmail-action-icon" onClick={() => setCurrentView({ app: "gmail", contact: null })} title="Back to inbox">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </div>
            <div className="gmail-action-icon" onClick={() => handleDeleteEmail(email.id)} title="Delete">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </div>
          <div className="gmail-action-icon" title="Mark as unread" onClick={async () => {
              // 1. Optimistic UI update
              setGmailEmails(prev => prev.map(e => e.id === email.id ? { ...e, isUnread: true } : e));
              
              // 2. Return to inbox immediately for smooth UX
              setCurrentView({ app: "gmail", contact: null });

              // 3. Sync with backend
              try {
                await fetch("/.netlify/functions/gmail-mark-unread", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ messageId: email.id })
                });
              } catch (err) {
                console.error("Failed to mark unread", err);
              }
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>
            </div>
          </div>

          {/* Subject Line Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 8px 56px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 400, color: "#1f1f1f", margin: 0, display: "flex", alignItems: "center", gap: "12px", fontFamily: "'Google Sans', Roboto, Arial, sans-serif" }}>
              {email.subject}
              <span style={{ fontSize: "12px", background: "#f1f3f4", padding: "2px 6px", borderRadius: "4px", color: "#5f6368", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                Inbox
                <span style={{ fontSize: "10px", cursor: "pointer" }}>✕</span>
              </span>
            </h2>
            <div style={{ display: "flex", gap: "16px", color: "#5f6368" }}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
            </div>
          </div>

          {/* Sender Info Row */}
          <div style={{ display: "flex", alignItems: "flex-start", marginTop: "16px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#5c6bc0", color: "white", display: "grid", placeItems: "center", fontSize: "18px", marginRight: "16px", flexShrink: 0 }}>
              {email.fromName ? email.fromName.charAt(0).toUpperCase() : "U"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      <span style={{ fontWeight: 600, color: "#202124", fontSize: "14px" }}>{email.fromName}</span>
                      <span style={{ color: "#5f6368", fontSize: "12px" }}>{email.fromEmail}</span>
                    </div>
                   <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#5f6368", fontSize: "12px", flexShrink: 0 }}>
                      <span>{email.time} ({timeAgo(email.date)})</span>
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </div>
                  </div>
                  
                {/* 🔽 INTERACTIVE "TO ME" POPOVER */}
                  <div style={{ position: "relative", marginTop: "2px" }}>
                    <div 
                      style={{ 
                        fontSize: "12px", 
                        color: "#5f6368", 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: "4px", 
                        cursor: "pointer", 
                        padding: "2px 4px", 
                        marginLeft: "-4px", 
                        borderRadius: "4px",
                        position: "relative", // 👈 Ensures z-index works
                        zIndex: showEmailDetails ? 95 : "auto" // 👈 Keeps button above the invisible backdrop
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowEmailDetails(prev => !prev);
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      to me <span style={{ fontSize: "10px" }}>{showEmailDetails ? "▲" : "▼"}</span>
                    </div>

                    {showEmailDetails && (
                      <>
                        {/* Invisible backdrop to close the menu when clicking outside */}
                        <div 
                          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} 
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowEmailDetails(false);
                          }}
                        />
                        
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: "0",
                          marginTop: "4px",
                          background: "white",
                          border: "1px solid #dadce0",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                          padding: "16px",
                          zIndex: 100,
                          minWidth: "480px",
                          fontSize: "13px",
                          color: "#202124",
                          display: "flex",
                          flexDirection: "column"
                        }}>
                          <div style={{ display: "grid", gridTemplateColumns: "75px 1fr", gap: "8px 12px", alignItems: "baseline" }}>
                            <span style={{ color: "#5f6368", textAlign: "right" }}>from:</span>
                            <span><strong>{email.fromName}</strong> {email.fromEmail}</span>
                            
                            <span style={{ color: "#5f6368", textAlign: "right" }}>to:</span>
                            <span>{email.to ? email.to.join(", ") : "Siyabonga Nono <siyabonga@actuaryconsulting.co.za>"}</span>
                            
                            <span style={{ color: "#5f6368", textAlign: "right" }}>date:</span>
                            <span>{email.date ? new Date(email.date).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : email.time}</span>
                            
                            <span style={{ color: "#5f6368", textAlign: "right" }}>subject:</span>
                            <span>{email.subject}</span>

                            <span style={{ color: "#5f6368", textAlign: "right" }}>mailed-by:</span>
                            <span>actuaryconsulting.co.za</span>

                            <span style={{ color: "#5f6368", textAlign: "right" }}>signed-by:</span>
                            <span>actuaryconsulting.co.za</span>
                            
                            <span style={{ color: "#5f6368", textAlign: "right" }}>security:</span>
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#5f6368" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                              Standard encryption (TLS)
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
          </div>

{/* Email Body */}
          <div className="email-body" style={{ marginLeft: "56px", marginTop: "24px", paddingRight: "48px", paddingBottom: "60px" }}>
            {email.bodyHtml ? (
              <div
                className="email-body-html"
                style={{ fontFamily: "'Google Sans', Roboto, Arial, sans-serif", fontSize: "14px", color: "#202124", lineHeight: "1.6" }}
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <div className="email-body-text" style={{ fontFamily: "Roboto, Arial, sans-serif", fontSize: "14px", color: "#202124", wordBreak: "break-word" }}>
                {(() => {
                  const body = email.body || "";
                  
                  const renderFormattedBody = (text, depth = 0) => {
                    const forwardRegex = /[-]{3,}\s*Forwarded message\s*[-]{3,}/i;
                    const replyRegex = /(^On\s.+\sat\s.+\s.+\swrote:)/im;

                    if (forwardRegex.test(text)) {
                      const parts = text.split(forwardRegex);
                      return (
                        <>
                          {parts[0] && (
                            <div className="gmail-paragraph-wrapper">
                              {parts[0].trim().split('\n').map((line, i) => (
                                <div key={i} style={{ marginBottom: line.trim() ? "14px" : "8px", minHeight: line.trim() ? "auto" : "12px" }}>{line}</div>
                              ))}
                            </div>
                          )}
                          {parts.slice(1).map((segment, idx) => (
                            <div key={idx} className="gmail-forward-wrap" style={{ marginTop: "28px", paddingLeft: depth > 0 ? "12px" : "0", borderLeft: depth > 0 ? "1px solid #dadce0" : "none" }}>
                              <div style={{ color: "#5f6368", fontSize: "13px", marginBottom: "16px", fontStyle: "normal" }}>
                                ---------- Forwarded message ---------
                              </div>
                              {renderFormattedBody(segment.trim(), depth + 1)}
                            </div>
                          ))}
                        </>
                      );
                    }

                    if (replyRegex.test(text)) {
                      const parts = text.split(replyRegex);
                      return (
                        <>
                          {parts[0] && <div>{parts[0].trim()}</div>}
                          <div className="gmail-reply-quote" style={{ borderLeft: "2px solid #72a8ff", paddingLeft: "16px", color: "#505050", marginTop: "16px" }}>
                            <div style={{ fontWeight: "500", marginBottom: "12px", color: "#5f6368" }}>{parts[1]}</div>
                            {parts.slice(2).join("").split('\n').map((line, i) => (
                              <div key={i} style={{ marginBottom: "12px" }}>{line}</div>
                            ))}
                          </div>
                        </>
                      );
                    }

                    // Fallback for standard text: Use pre-wrap to respect original formatting
                  return (
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                      {text}
                    </div>
                  );
                  };

                  return renderFormattedBody(body);
                })()}
              </div>
            )}
          </div>

         {/* Attachments Section */}
          {att.length > 0 && (
            <div style={{ marginLeft: "56px", marginTop: "24px" }}>
              <div style={{ borderTop: "1px solid #f1f3f4", margin: "16px 0", width: "100%" }}></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#202124' }}>{att.length} attachment{att.length > 1 ? 's' : ''}</span>
                <span style={{ color: '#5f6368', fontSize: '13px' }}>· Scanned by Gmail ⓘ</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                  <button 
                    onClick={() => {
                      att.forEach((a, index) => {
                        setTimeout(() => {
                          const link = document.createElement('a');
                          link.href = a.url;
                          link.setAttribute('download', a.name);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }, index * 600);
                      });
                    }}
                    title="Download all"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368', padding: '8px', borderRadius: '50%' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  </button>
                </div>
              </div>

    <div className="email-attach-grid">
                {att.map((f, i) => {
                  const isPdf = f.type === 'pdf' || f.name.toLowerCase().includes('.pdf');
                  const isImg = f.type === 'img' || f.name.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/i);
                  const isXls = f.type === 'xls' || f.name.toLowerCase().match(/\.(xls|xlsx|csv)$/i);
                  const isWord = f.type === 'doc' || f.name.toLowerCase().match(/\.(doc|docx)$/i);
                  
                  const iconColor = isPdf ? '#ea4335' : isImg ? '#a142f4' : isXls ? '#188038' : isWord ? '#1a73e8' : '#5f6368';
                  const displayType = isPdf ? 'PDF' : isImg ? 'IMG' : isXls ? 'XLS' : isWord ? 'DOC' : 'FILE';

                  return (
                    <button
                      key={i}
                      className="email-attach"
                      onClick={() => setEmailPreview(f)}
                      title={f.name}
                      style={{ background: "#fff", border: "1px solid #dadce0", borderRadius: "8px", width: "180px", height: "auto", padding: "0", overflow: "hidden", display: "flex", flexDirection: "column" }}
                    >
                      <div className="email-attach-preview" style={{ height: "100px", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* Iframe removed to prevent auto-downloads. Replaced with dynamic type icon. */}
                        <div style={{ fontSize: "28px", fontWeight: "bold", color: iconColor, opacity: 0.3 }}>
                          {displayType}
                        </div>
                      </div>
                      <div className="email-attach-footer" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderTop: "1px solid #dadce0", width: "100%" }}>
                        <span style={{ background: iconColor, color: "white", padding: "2px 4px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>
                          {displayType}
                        </span>
                        <span className="email-attach-name" style={{ fontSize: "12px", color: "#3c4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
{/* Authentic Gmail Inline Reply Trigger & Actions */}
          {!selectedDraftTemplate && (
            <div style={{ marginLeft: "56px", marginTop: "32px", paddingBottom: "24px" }}>
              
              {/* Reply & Forward */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                <button 
                  className="gmail-btn-outline" 
                  onClick={() => {
                    const replyTpl = DRAFT_TEMPLATES.find(t => t.id === "new_blank");
                    setSelectedDraftTemplate({...replyTpl, body: "\n\n", isForward: false});
                    
                    let targetEmail = "";
                    if (email.fromEmail) {
                      targetEmail = email.fromEmail.replace("<", "").replace(">", "").trim();
                    } else if (email.fromName && email.fromName.includes("@")) {
                      targetEmail = email.fromName;
                    }
                    setDraftTo(targetEmail);
                  }}
                  style={{ borderRadius: "100px", padding: "8px 24px", color: "#3c4043", border: "1px solid #dadce0", display: "flex", alignItems: "center", gap: "8px", background: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                  Reply
                </button>
                <button 
                  className="gmail-btn-outline" 
                  onClick={() => {
                    const replyTpl = DRAFT_TEMPLATES.find(t => t.id === "new_blank");
                    
                    const cleanFromEmail = email.fromEmail ? email.fromEmail.replace(/[<>]/g, '') : "";
                    const fromLine = email.fromName && !email.fromName.includes("@") 
                        ? `${email.fromName} <${cleanFromEmail}>` 
                        : `<${cleanFromEmail || email.fromName}>`;
                    
                    // Fixed the hardcoded Yolandie string to correctly show Siya as the original recipient
                    const fwdHeader = `\n\n---------- Forwarded message ---------\nFrom: ${fromLine}\nDate: ${email.time}\nSubject: ${email.subject}\nTo: Siyabonga Nono <siyabonga@actuaryconsulting.co.za>\n\n`;
                    const fwdBody = email.body || email.snippet || "";
                    
                    setSelectedDraftTemplate({...replyTpl, body: fwdHeader + fwdBody, isForward: true});
                    setDraftTo(""); // Forwarding requires you to pick a new recipient
                  }}
                  style={{ borderRadius: "100px", padding: "8px 24px", color: "#3c4043", border: "1px solid #dadce0", display: "flex", alignItems: "center", gap: "8px", background: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>
                  Forward
                </button>
              </div>

              {/* Trello / Tracker Actions */}
              <div className="email-actions" style={{ borderTop: "1px solid #f1f3f4", paddingTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-start" }}>
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
                  onClick={() => setShowDraftPicker(prev => !prev)}
                >
                  Create Draft
                </button>
              </div>

              {email.systemNote && (
                <div className="email-note" style={{ marginTop: "12px" }}>{email.systemNote}</div>
              )}
            </div>
          )}

          {/* 🔽 TEMPLATE PICKER (Extracted outside the condition so it can render anytime) */}
          {showDraftPicker && (
            <div style={{ marginLeft: "56px", marginTop: "12px", marginBottom: "24px" }}>
              <div style={{ fontSize: "13px", color: "#5f6368", marginBottom: "8px" }}>Choose a draft template below.</div>
              <div className="draft-picker" style={{ background: "#f8f9fa", border: "1px solid #dadce0", padding: "16px", borderRadius: "8px" }}>
                <div className="draft-picker-title" style={{ color: "#202124", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>Choose a draft email template:</div>
                <div className="draft-picker-list" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {DRAFT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      className="draft-picker-item"
                      style={{ border: "1px solid #dadce0", padding: "8px 16px", color: "#3c4043", borderRadius: "100px", background: "#fff", cursor: "pointer", fontSize: "13px" }}
                      onClick={() => {
                        // Keeps existing recipient if replying, otherwise grabs sender email
                        if (!draftTo) {
                          let targetEmail = "";
                          if (email.fromEmail) {
                            targetEmail = email.fromEmail.replace("<", "").replace(">", "").trim();
                          }
                          setDraftTo(targetEmail);
                        }
                        setSelectedDraftTemplate(tpl);
                        setShowDraftPicker(false);
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

         {/* 🔽 INLINE GMAIL REPLY BOX (Pixel Perfect) */}
          {selectedDraftTemplate && (
            <div className="gmail-inline-reply-box" style={{ marginLeft: "56px", marginTop: "12px", border: "1px solid #dadce0", borderRadius: "12px", background: "#fff", padding: "0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", position: "relative", overflow: "hidden" }}>
              
            {/* Top Row: Reply Arrow & Recipient */}
              <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", background: "#fff", borderBottom: "1px solid transparent", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#5f6368", padding: "4px 8px", borderRadius: "4px", margin: "-4px 8px -4px -8px" }} className="gmail-action-icon">
                  {selectedDraftTemplate.isForward ? (
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginLeft: "2px" }}><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                </div>
                
                <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="text"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", width: "100%", color: "#202124", fontSize: "14px", fontWeight: 400 }}
                    placeholder={selectedDraftTemplate.isForward ? "To" : "Recipient"}
                  />
                  
                  {/* Suggestion Dropdown */}
                  {draftTo.length > 1 && !draftTo.includes("@") && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: "0",
                      width: "100%",
                      background: "white",
                      border: "1px solid #dadce0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 2000,
                      maxHeight: "200px",
                      overflowY: "auto",
                      borderRadius: "4px",
                      marginTop: "12px"
                    }}>
                      {Object.entries(AC_EMAIL_MAP)
                        .filter(([name]) => name.toLowerCase().includes(draftTo.toLowerCase()))
                        .map(([name, email]) => (
                          <div 
                            key={email}
                            onClick={() => setDraftTo(email)}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#f1f3f4"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            style={{
                              padding: "8px 12px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "13px",
                              color: "#202124"
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{name}</span>
                            <span style={{ color: "#5f6368" }}>{email}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <button className="gmail-action-icon" style={{ margin: "-4px -8px -4px 8px" }} title="Pop out reply">
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                </button>
              </div>

              {/* Text Area */}
              <div style={{ maxHeight: "350px", overflowY: "auto", padding: "0 16px" }}>
                <textarea
                  autoFocus
                  className="email-draft-textarea"
                  value={selectedDraftTemplate.body}
                  onChange={(e) => setSelectedDraftTemplate((prev) => prev ? { ...prev, body: e.target.value } : prev)}
                  style={{
                    width: "100%", border: "none", outline: "none", minHeight: "150px", fontSize: "14px", resize: "none", marginTop: "8px"
                  }}
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                />
                <EmailSignature />
              </div>

              {/* ATTACHMENT PREVIEW ROW */}
              {draftAttachments.length > 0 && (
                <div style={{ padding: "8px 16px", borderTop: "1px solid #e0e4f0", display: "flex", gap: "8px", flexWrap: "wrap", background: "#f8f9fa" }}>
                  {draftAttachments.map((file, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #dadce0", borderRadius: "16px", padding: "4px 10px", fontSize: "12px", color: "#3c4043" }}>
                      <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                      <span style={{ color: "#5f6368" }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button 
                        onClick={() => setDraftAttachments(prev => prev.filter((_, i) => i !== idx))} 
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 2px", color: "#5f6368", display: "flex", alignItems: "center" }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    className="btn blue"
                    style={{ borderRadius: "24px", padding: "8px 16px 8px 24px", fontSize: "14px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px" }}
                    onClick={async () => {
                      if (!draftTo.trim()) {
                        setEmail((prev) => prev ? { ...prev, systemNote: "Please add a recipient address." } : prev);
                        return;
                      }
                      try {
                        const base64Attachments = await Promise.all(draftAttachments.map(file => {
                          return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve({
                              filename: file.name,
                              mimeType: file.type || "application/octet-stream",
                              content: reader.result.split(',')[1]
                            });
                            reader.readAsDataURL(file);
                          });
                        }));

                        // Auto-generates "Re: [Subject]" or "Fwd: [Subject]" 
                        const prefix = selectedDraftTemplate.isForward ? "Fwd:" : "Re:";
                        const replySubject = email?.subject?.startsWith(prefix) ? email.subject : `${prefix} ${email?.subject || "New Message"}`;

                        const res = await fetch("/.netlify/functions/gmail-send-email", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            to: draftTo,
                            subject: replySubject,
                            body: selectedDraftTemplate.body,
                            attachments: base64Attachments 
                          }),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
                        
                        setEmail((prev) => prev ? { ...prev, systemNote: `Email sent successfully to: ${draftTo}` } : prev);
                        setSelectedDraftTemplate(null);
                        setDraftTo("");
                        setDraftAttachments([]);
                      } catch (err) {
                        setEmail((prev) => prev ? { ...prev, systemNote: `Sending failed: ${err?.message || String(err)}` } : prev);
                      }
                    }}
                  >
                    Send
                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "6px", marginLeft: "2px", boxSizing: "content-box" }}><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                  </button>
                  
                  {/* Formatting / Paperclip Icons */}
                  <div style={{ display: "flex", alignItems: "center", color: "#5f6368" }}>
                    <input 
                      type="file" 
                      multiple 
                      ref={draftFileInputRef} 
                      style={{ display: "none" }} 
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const validFiles = files.filter(f => f.size <= 4.5 * 1024 * 1024);
                        if (validFiles.length < files.length) alert("Some files were skipped because they exceed the 4.5MB limit.");
                        setDraftAttachments(prev => [...prev, ...validFiles]);
                        e.target.value = "";
                      }} 
                    />
                    <button 
                      className="gmail-action-icon" 
                      onClick={() => draftFileInputRef.current?.click()}
                      title="Attach files"
                      style={{ padding: "6px" }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-3.31-2.69-6-6-6S3 1.69 3 5v11.5c0 3.86 3.14 7 7 7s7-3.14 7-7V6h-1.5z"/></svg>
                    </button>
                    {/* NEW: Three Dots toggle for templates while replying */}
                    <button 
                      className="gmail-action-icon" 
                      title="More options (Templates)" 
                      onClick={() => setShowDraftPicker(prev => !prev)}
                      style={{ padding: "6px" }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>
                  </div>
                </div>

                {/* Delete / Discard Icon */}
                <button 
                  className="gmail-action-icon" 
                  title="Discard draft"
                  onClick={() => {
                    setSelectedDraftTemplate(null);
                    setDraftTo("");
                    setDraftAttachments([]);
                    setEmail((prev) => prev ? { ...prev, systemNote: undefined } : prev);
                  }}
                  style={{ padding: "8px", margin: "-8px" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zM9 8h2v9H9zm4 0h2v9h-2z"/></svg>
                </button>
              </div>
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
      <div className="trello-modal" style={{ maxWidth: "1200px", width: "95%", margin: "0 auto" }}>
        {/* 1. TOP BAR (Icon + Title + Close) */}
        {/* 1. TOP BAR (Icon + Title + Actions) */}
        {/* 1. TOP BAR (Icon + Title + Actions) */}
        {/* 1. TOP BAR (Icon + Title + Actions) */}
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
          
          {/* ACTIONS: Kebab Menu & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            
            <div className="kebab-wrap" style={{ position: 'relative' }}>
              <button 
                className="trello-close" 
                style={{ fontSize: '18px', paddingBottom: '8px' }} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setTrelloMenuOpen(!trelloMenuOpen); 
                  setShowMoveSubmenu(false); 
                }}
              >
                •••
              </button>

              {/* DROPDOWN MENU */}
              {trelloMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: '40px', background: '#ffffff', boxShadow: '0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)', borderRadius: '3px', width: '300px', zIndex: 999, padding: showMoveSubmenu ? '0' : '8px 0', fontSize: '14px', color: '#172b4d' }}>
                  
                  {!showMoveSubmenu ? (
                    <>
                      <div style={{ padding: '0 12px 8px', borderBottom: '1px solid rgba(9,30,66,0.13)', marginBottom: '8px', fontWeight: 600, textAlign: 'center', fontSize: '14px', color: '#5e6c84' }}>
                        Actions
                      </div>
                      {/* MOVE OPTION */}
                      <div 
                        style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#172b4d' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#091e420f'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setMoveTargetList(c.listId); 
                          
                          // ⚡ Set exact current position and clear old searches
                          const currentBucket = trelloBuckets.find(b => b.id === c.listId);
                          const currentPos = currentBucket ? currentBucket.cards.findIndex(x => x.id === c.id) + 1 : 1;
                          setMoveTargetPos(currentPos > 0 ? currentPos : 1);
                          
                          setMoveTab("outbox");
                          setMoveListSearch(""); 
                          setShowMoveSubmenu(true); 
                        }}
                      >
                        <span>Move</span>
                        <span>›</span>
                      </div>

                      {/* ARCHIVE / RESTORE OPTION */}
                      {c.isArchived ? (
                        <div 
                          style={{ padding: '8px 16px', cursor: 'pointer', color: '#172b4d' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#091e420f'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const cid = c.id;
                            
                            // Optimistic Update
                            window.dispatchEvent(new Event("pauseTrelloPolling"));
                            setTrelloCard(prev => ({ ...prev, isArchived: false, boardList: "Restored" }));
                            setTrelloMenuOpen(false);

                            try {
                              await fetch("/.netlify/functions/trello-restore", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ cardId: cid })
                              });
                            } catch (err) { console.error("Restore failed", err); }
                          }}
                        >
                          Restore
                        </div>
                      ) : (
                        <div 
                          style={{ padding: '8px 16px', cursor: 'pointer', color: '#172b4d' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#091e420f'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const cid = c.id;
                            
                            // Optimistic Update
                            window.dispatchEvent(new Event("pauseTrelloPolling"));
                            setTrelloBuckets(prev => prev.map(b => ({ ...b, cards: b.cards.filter(card => card.id !== cid) })));
                            setTrelloMenuOpen(false);
                            setTrelloCard(null);

                            try {
                              await fetch("/.netlify/functions/trello-archive", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ cardId: cid })
                              });
                            } catch (err) { console.error("Archive failed", err); }
                          }}
                        >
                          Archive
                        </div>
                      )}
                    </>
                  ) : (
                    /* SUB-MENU: MOVE CARD UI */
                    <div style={{ padding: '12px' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', position: 'relative', color: '#5e6c84' }}>
                        <button onClick={(e) => {e.stopPropagation(); setShowMoveSubmenu(false);}} style={{ position: 'absolute', left: 0, border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'18px' }}>‹</button>
                        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: '14px' }}>Move card</div>
                        <button onClick={(e) => {e.stopPropagation(); setTrelloMenuOpen(false); setShowMoveSubmenu(false);}} style={{ position: 'absolute', right: 0, border:'none', background:'none', cursor:'pointer', color:'#42526e', fontSize:'16px' }}>✕</button>
                      </div>
                      
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '2px solid #ebecf0' }}>
                        <div onClick={(e) => {e.stopPropagation(); setMoveTab('inbox'); setMoveTargetList(c.listId);}} style={{ paddingBottom: '8px', cursor: 'pointer', marginBottom: '-2px', color: moveTab === 'inbox' ? '#0052cc' : '#5e6c84', borderBottom: moveTab === 'inbox' ? '2px solid #0052cc' : '2px solid transparent', fontWeight: moveTab === 'inbox' ? 600 : 400 }}>Inbox</div>
                        <div onClick={(e) => {e.stopPropagation(); setMoveTab('outbox');}} style={{ paddingBottom: '8px', cursor: 'pointer', marginBottom: '-2px', color: moveTab === 'outbox' ? '#0052cc' : '#5e6c84', borderBottom: moveTab === 'outbox' ? '2px solid #0052cc' : '2px solid transparent', fontWeight: moveTab === 'outbox' ? 600 : 400 }}>Board</div>
                      </div>

                      {/* Body */}
                      {moveTab === 'inbox' && (
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#5e6c84', marginBottom:'4px' }}>Select position</label>
                          <select 
                             value={moveTargetPos} 
                             onChange={(e) => setMoveTargetPos(Number(e.target.value))} 
                             style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', cursor: 'pointer', outline: 'none' }} 
                             onClick={e => e.stopPropagation()}
                          >
                             {Array.from({ length: Math.max(1, trelloBuckets.find(b => b.id === c.listId)?.cards.length || 1) }, (_, i) => (
                                <option key={i+1} value={i+1}>{i+1}</option>
                             ))}
                          </select>
                        </div>
                      )}

                      {moveTab === 'outbox' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                          {/* 🔍 SEARCH BAR */}
                          <div>
                            <input 
                              type="text" 
                              placeholder="Search board lists..." 
                              value={moveListSearch}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setMoveListSearch(val);
                                  
                                  // ⚡ AUTO-SELECT FIX
                                  const uniqueMap = new Map();
                                  allTrelloLists.forEach(l => {
                                      if (!uniqueMap.has(l.title)) uniqueMap.set(l.title, l);
                                  });
                                  let unique = Array.from(uniqueMap.values());
                                  
                                  // ⚡ Remove junk lists after "Submitted August 2025"
                                  const cutoffIndex = unique.findIndex(l => l.title.toLowerCase().trim() === "submitted august 2025");
                                  if (cutoffIndex !== -1) unique = unique.slice(0, cutoffIndex + 1);

                                  const filtered = unique.filter(l => l.title.toLowerCase().includes(val.toLowerCase()));
                                  
                                  if (filtered.length > 0) {
                                      const firstMatch = filtered[0];
                                      setMoveTargetList(firstMatch.id);
                                      
                                      if (firstMatch.id === c.listId) {
                                          const cb = trelloBuckets.find(b => b.id === c.listId);
                                          const cp = cb ? cb.cards.findIndex(x => x.id === c.id) + 1 : 1;
                                          setMoveTargetPos(cp > 0 ? cp : 1);
                                      } else {
                                          setMoveTargetPos(1);
                                      }
                                  }
                              }}
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', outline: 'none', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 2 }}>
                              <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#5e6c84', marginBottom:'4px' }}>List</label>
                              <select 
                                 value={moveTargetList} 
                                 onChange={(e) => { setMoveTargetList(e.target.value); setMoveTargetPos(1); }} 
                                 style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', cursor: 'pointer', outline: 'none' }} 
                                 onClick={e => e.stopPropagation()}
                              >
                                 {(() => {
                                    // ⚡ 1. Deduplicate by name to remove Trello ghosts
                                    const uniqueMap = new Map();
                                    allTrelloLists.forEach(l => {
                                        if (!uniqueMap.has(l.title)) uniqueMap.set(l.title, l);
                                    });
                                    let unique = Array.from(uniqueMap.values());
                                    
                                    // ⚡ 1.5 Cut off junk lists after "Submitted August 2025"
                                    const cutoffIndex = unique.findIndex(l => l.title.toLowerCase().trim() === "submitted august 2025");
                                    if (cutoffIndex !== -1) unique = unique.slice(0, cutoffIndex + 1);

                                    // ⚡ 2. Filter the visual options by your search text
                                    const search = (moveListSearch || "").toLowerCase();
                                    const filtered = unique.filter(l => l.title.toLowerCase().includes(search));

                                    if (filtered.length === 0) return <option value="">No match found</option>;
                                    return filtered.map(b => <option key={b.id} value={b.id}>{b.title}</option>);
                                 })()}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#5e6c84', marginBottom:'4px' }}>Position</label>
                              <select 
                                 value={moveTargetPos} 
                                 onChange={(e) => setMoveTargetPos(Number(e.target.value))} 
                                 style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', background: '#fafbfc', color: '#172b4d', cursor: 'pointer', outline: 'none' }} 
                                 onClick={e => e.stopPropagation()}
                              >
                                 {(() => {
                                    // ⚡ 0ms LAG FIX: Check local trelloBuckets first for instant count
                                    const localBucket = trelloBuckets.find(b => b.id === moveTargetList);
                                    const globalBucket = allTrelloLists.find(b => b.id === moveTargetList);
                                    
                                    // Priority: Local State > Global Polled State > 0
                                    const currentCount = localBucket ? localBucket.cards.length : (globalBucket?.cardsLength || 0);
                                    
                                    const isSameList = moveTargetList === c.listId;
                                    const maxPos = isSameList ? Math.max(1, currentCount) : currentCount + 1;
                                    
                                    return Array.from({ length: maxPos }, (_, i) => (
                                       <option key={i+1} value={i+1}>{i+1}</option>
                                    ));
                                 })()}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      <button 
                        style={{ width: '100%', padding: '8px', borderRadius: '3px', fontWeight: 600, justifyContent: 'center', background: '#0052cc', color: '#fff', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0065ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#0052cc'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          
                          const cid = c.id;
                          const targetId = moveTargetList;
                          const newIndex = moveTargetPos - 1; // 0-based for arrays
                          const targetName = trelloBuckets.find(b => b.id === targetId)?.title || c.boardList;

                          // 1. Optimistic Update: Move instantly on UI
                          window.dispatchEvent(new Event("pauseTrelloPolling"));
                          setTrelloBuckets(prev => {
                            let cardToMove = null;
                            const stripped = prev.map(b => {
                                if (b.id === c.listId) {
                                    const idx = b.cards.findIndex(x => x.id === cid);
                                    if (idx > -1) {
                                        cardToMove = b.cards[idx];
                                        const newCards = [...b.cards];
                                        newCards.splice(idx, 1);
                                        return { ...b, cards: newCards };
                                    }
                                }
                                return b;
                            });
                            if (!cardToMove) return prev;
                            return stripped.map(b => {
                                if (b.id === targetId) {
                                    const newCards = [...b.cards];
                                    newCards.splice(newIndex, 0, cardToMove);
                                    return { ...b, cards: newCards };
                                }
                                return b;
                            });
                          });

                          setTrelloCard(prev => ({ ...prev, listId: targetId, boardList: targetName }));
                          setTrelloMenuOpen(false);
                          setShowMoveSubmenu(false);

                          // 2. Background Sync
                          try {
                            await fetch("/.netlify/functions/trello-move", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ cardId: cid, targetListId: targetId, newIndex: newIndex })
                            });
                          } catch (err) { console.error("Move failed", err); }
                        }}
                      >
                        Move
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              className="trello-close"
              onClick={() => { setTrelloMenuOpen(false); setTrelloCard(null); }}
            >✕</button>
          </div>
        </div>

        {/* 2. BODY (Columns) */}
        <div className="trello-modal-body">
          
          {/* LEFT COLUMN (60%) */}
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
                  
                  {c.isArchived ? (
                     <div style={{ color: '#5e6c84', fontSize: '13px', fontWeight: 600, padding: '6px 12px', background: '#091e420f', borderRadius: '4px' }}>
                        Read-Only (Restore card to track time)
                     </div>
                  ) : parseFloat(c.customFields?.WorkTimerStart) > 1000000000000 ? (
                      <button 
                        className="btn-red" 
                        style={{ backgroundColor: '#eb5a46', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', width: '105px', textAlign: 'center' }}
                        onClick={async () => {
                           const stopTime = Date.now();
                           const startTime = parseFloat(c.customFields.WorkTimerStart);
                           const sessionMins = (stopTime - startTime) / 1000 / 60;
                           const oldDur = parseFloat(c.customFields.WorkDuration || "0");
                           const newTotal = (oldDur + sessionMins).toFixed(2);
                           
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkDuration", ttlMs: 10000 } }));
                           window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "WorkTimerStart", ttlMs: 10000 } }));

                           setTrelloCard(prev => ({
                              ...prev, customFields: { ...prev.customFields, WorkTimerStart: null, WorkDuration: newTotal }
                           }));

                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, WorkTimerStart: null, WorkDuration: newTotal } 
                              }) }
                           }));

                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST", body: JSON.stringify({ cardId: c.id, fieldName: "WorkDuration", valueText: String(newTotal) })
                              });
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST", body: JSON.stringify({ cardId: c.id, fieldName: "WorkTimerStart", valueText: "" })
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
                              ...prev, customFields: { ...prev.customFields, WorkTimerStart: now }
                           }));
                           window.dispatchEvent(new CustomEvent("patchCardInBuckets", {
                              detail: { cardId: c.id, updater: old => ({ 
                                 ...old, customFields: { ...old.customFields, WorkTimerStart: now } 
                              }) }
                           }));
                           try {
                              await fetch("/.netlify/functions/trello-set-custom-field", {
                                 method: "POST", body: JSON.stringify({ cardId: c.id, fieldName: "WorkTimerStart", valueText: String(now) })
                              });
                           } catch(err) { console.error("WorkFlow Timer Start Failed", err); }
                        }}
                      >
                        Start timer
                      </button>
                  )}

                  <div className="timer-display">
                     {/* Pass null for start time if archived, so the clock stops ticking visually! */}
                     <LiveTimer 
                        startTime={!c.isArchived ? c.customFields?.WorkTimerStart : null} 
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
                      
                      {c.isArchived ? (
                         <div style={{ color: '#5e6c84', fontSize: '13px', fontWeight: 600, padding: '6px 12px', background: '#091e420f', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>
                            Read-Only (Restore card to track time)
                         </div>
                      ) : c.customFields?.TimerStart ? (
                          <button 
                            className="btn-red" 
                            style={{ backgroundColor: '#eb5a46', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
                            onClick={async () => {
                               const stopTime = Date.now();
                               const startTime = parseFloat(c.customFields.TimerStart);
                               const sessionMins = (stopTime - startTime) / 1000 / 60;
                               const oldDur = parseFloat(c.customFields.Duration || "0");
                               const newTotal = (oldDur + sessionMins).toFixed(2);
                               
                               window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Duration", ttlMs: 10000 } }));
                               window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "TimerStart", ttlMs: 10000 } }));

                               setTrelloCard(prev => ({
                                  ...prev, customFields: { ...prev.customFields, TimerStart: null, Duration: newTotal }
                               }));

                               await fetch("/.netlify/functions/trello-timer", {
                                  method: "POST", body: JSON.stringify({ cardId: c.id, action: "stop" })
                               });
                               
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
                               const now = Date.now();
                               
                               window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "TimerStart", ttlMs: 10000 } }));

                               setTrelloCard(prev => ({
                                  ...prev, customFields: { ...prev.customFields, TimerStart: now }
                               }));

                               await fetch("/.netlify/functions/trello-timer", {
                                  method: "POST", body: JSON.stringify({ cardId: c.id, action: "start" })
                               });

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

                      {!c.isArchived && (
                         <button 
                            className="t-btn-gray" 
                            title="Add manual time"
                            onClick={() => setShowAddTime(!showAddTime)}
                         >
                            <span>+</span> Add time
                         </button>
                      )}

                      {/* POPUP FOR MANUAL TIME */}
                      {showAddTime && !c.isArchived && (
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

                                    window.dispatchEvent(new CustomEvent("pendingCF", { detail: { cardId: c.id, field: "Duration", ttlMs: 10000 } }));

                                    setTrelloCard(prev => ({
                                       ...prev,
                                       customFields: { ...prev.customFields, Duration: newTotal }
                                    }));
                                    setShowAddTime(false);
                                    setManualHours("0");
                                    setManualMins("0");

                                    await fetch("/.netlify/functions/trello-set-custom-field", {
                                       method: "POST",
                                       body: JSON.stringify({ 
                                          cardId: c.id, 
                                          fieldName: "Duration", 
                                          valueText: newTotal 
                                       })
                                    });

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
                            startTime={!c.isArchived ? c.customFields?.TimerStart : null} 
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

         {/* RIGHT COLUMN (40%) */}
         <div className="trello-sidebar-col">
            <ActivityPane
                cardId={c.id} 
                currentUserAvatarUrl="https://trello-avatars.s3.amazonaws.com/cee5b736fb38fc4e0555e8491649392c/50.png" 
             />
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
        isDraftEnlarged,
        draftPos,
        draftAttachments,

       // Gmail Inbox
        gmailEmails,
        gmailLoading,
        gmailError,
        gmailEmails, // 👈 ADD THIS: Tells React to refresh the list when a star is clicked
        gmailFolder, // 👈 ADD THIS: Tells React to refresh when you switch to "Starred" view
        gmailPage,
        gmailTotal,

       // Trello
        trelloCard,
        trelloMenuOpen,
        descEditing,
        descDraft,
        showLabelPicker, 
        showMoveSubmenu,
        moveTab,
        moveTargetList,
        moveTargetPos,
        trelloBuckets,
        selectedEmailIds,
        searchQuery,
        allTrelloLists, // 👈 Fixes the Dropdown options
        moveListSearch, // 👈 Fixes the Search Bar
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
              <span>[{n.time}] {n.alt === "Gmail" ? n.text : `${n.alt}: ${n.text}`}</span>
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
                setGchatSelectedSpace(null); 
                setInputValue("");           
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

// Helper to turn raw Trello action data into human readable text
const formatTrelloAction = (action) => {
  const actor = action.memberCreator?.fullName || "Someone";
  const data = action.data;
  const type = action.type;

  switch (type) {
    case "commentCard":
      return { text: `${actor} commented`, comment: data.text, type: "comment" };
    case "updateCard":
      if (data.listBefore && data.listAfter) {
        return { text: `${actor} moved this card from ${data.listBefore.name} to ${data.listAfter.name}`, type: "system" };
      }
      if (data.old && data.old.closed === false && data.card?.closed === true) {
        return { text: `${actor} archived this card`, type: "system" };
      }
      if (data.old && data.old.closed === true && data.card?.closed === false) {
        return { text: `${actor} sent this card to the board`, type: "system" };
      }
      return null; 
    case "createCard":
    case "copyCard":
       if(data.list) {
          return { text: `${actor} added this card to ${data.list.name}`, type: "creation" };
       }
       return { text: `${actor} created this card`, type: "creation" };
    default:
      return null;
  }
};

// Helper for relative time (e.g., "17 minutes ago")
const timeAgo = (dateParam) => {
  if (!dateParam) return null;
  const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
  const today = new Date();
  const seconds = Math.round((today - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

// ---------------- NEW ACTIVITY COMPONENT ----------------
const ActivityPane = React.memo(function ActivityPane({ cardId, currentUserAvatarUrl }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(true); // 👈 NEW: Toggle State

  // Fetch actions whenever the opened card changes
  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    fetch(`/.netlify/functions/trello-actions?cardId=${cardId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
           const formatted = data.map(a => ({ ...a, formatted: formatTrelloAction(a) })).filter(a => a.formatted).slice(0, 20);
           setActions(formatted);
        }
      })
      .catch(err => console.error("Failed to load activity", err))
      .finally(() => setLoading(false));
  }, [cardId]);

  const handleSaveComment = async () => {
    if (!commentInput.trim() || isSaving) return;
    setIsSaving(true);
    const textToSave = commentInput.trim();

    const optimisticAction = {
      id: "opt-" + Date.now(),
      date: new Date().toISOString(),
      memberCreator: { fullName: "You", avatarHash: null }, 
      formatted: { text: `You commented`, comment: textToSave, type: "comment" } // Added type here
    };
    setActions(prev => [optimisticAction, ...prev]);
    
    setCommentInput("");
    setIsFocused(false);

    try {
      const res = await fetch("/.netlify/functions/trello-add-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, text: textToSave })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save comment");
    } catch(err) {
      console.error("Comment save error:", err);
      alert("Failed to save comment to Trello.");
      setActions(prev => prev.filter(a => a.id !== optimisticAction.id));
      setCommentInput(textToSave);
      setIsFocused(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Trello aesthetic styles
  const styles = {
    container: { marginTop: '0px', color: '#172b4d' }, // 👈 CHANGED: 0px pushes it up
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    headerTitle: { fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' },
    hideBtn: { background: '#091e420f', border: 'none', padding: '6px 12px', borderRadius: '3px', fontWeight: '500', cursor: 'pointer', color: '#172b4d' },
    commentSection: { display: 'flex', gap: '12px', marginBottom: '24px' },
    avatar: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#dfe1e6', backgroundSize: 'cover', flexShrink: 0 },
    inputWrapper: { flexGrow: 1 },
    commentInput: { 
        width: '100%', borderRadius: '3px', border: isFocused ? '2px solid #0079bf' : '1px solid #dfe1e6', 
        padding: '8px 12px', fontSize: '14px', transition: 'all 0.2s', outline: 'none', minHeight: isFocused ? '80px' : 'auto', resize: 'none',
        boxShadow: isFocused ? '0 0 0 2px #ffffff, 0 0 0 4px #0079bf' : 'none', fontFamily: "inherit"
    },
    controls: { marginTop: '8px', display: isFocused ? 'flex' : 'none', gap: '8px' },
    saveBtn: { background: '#0079bf', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '3px', fontWeight: '500', cursor: 'pointer' },
    discardBtn: { background: 'transparent', color: '#42526e', border: 'none', padding: '6px 12px', borderRadius: '3px', fontWeight: '500', cursor: 'pointer' },
    activityList: { display: 'flex', flexDirection: 'column', gap: '16px' },
    actItem: { display: 'flex', gap: '12px', fontSize: '14px' },
    actContent: { display: 'flex', flexDirection: 'column' },
    actText: { fontWeight: '400', color: '#172b4d' },
    actMeta: { fontSize: '12px', color: '#5e6c84', marginTop: '2px' },
    commentBubble: { background: 'white', padding: '8px 12px', borderRadius: '3px', border: '1px solid #dfe1e6', marginTop: '6px', boxShadow: '0 1px 1px #091e4240', color: '#172b4d' }
  };

  const getAvatar = (hash) => hash ? `https://trello-avatars.s3.amazonaws.com/${hash}/50.png` : null;

  // 👈 NEW: Filter logic for Hide/Show details
  const visibleActions = actions.filter(act => {
    if (showDetails) return true;
    // When hidden, only show Comments and "Added to list" (Creation) events
    return act.formatted.type === "comment" || act.formatted.type === "creation";
  });

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="#42526e"><path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3ZM11 17H7V15H11V17ZM17 13H7V11H17V13ZM17 9H7V7H17V9Z"></path></svg>
           Comments and activity
        </div>
        <button 
           style={styles.hideBtn} 
           onClick={() => setShowDetails(!showDetails)}
           onMouseEnter={e => e.currentTarget.style.background = '#091e4214'}
           onMouseLeave={e => e.currentTarget.style.background = '#091e420f'}
        >
           {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* COMMENT INPUT */}
      <div style={styles.commentSection}>
        <div style={{...styles.avatar, backgroundImage: `url(${currentUserAvatarUrl})`}}></div>
        <div style={styles.inputWrapper}>
             <textarea 
                style={styles.commentInput} 
                placeholder="Write a comment..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
             />
             <div style={styles.controls}>
                 <button 
                    style={{...styles.saveBtn, opacity: (!commentInput.trim() || isSaving) ? 0.5 : 1}} 
                    disabled={!commentInput.trim() || isSaving}
                    onClick={handleSaveComment}
                 >
                    {isSaving ? "Saving..." : "Save"}
                 </button>
                 <button style={styles.discardBtn} onClick={() => { setIsFocused(false); setCommentInput(""); }}>Discard</button>
             </div>
        </div>
      </div>

      {/* ACTIVITY STREAM */}
      <div style={styles.activityList}>
        {loading && <div style={{color: '#5e6c84', fontStyle: 'italic'}}>Loading activity...</div>}
        {!loading && visibleActions.map(act => (
          <div key={act.id} style={styles.actItem}>
            <div style={{...styles.avatar, backgroundImage: `url(${getAvatar(act.memberCreator?.avatarHash)})`}}></div>
            <div style={styles.actContent}>
               <div>
                  <span style={styles.actText}>
                    <strong style={{fontWeight: 600}}>{act.formatted.text.split(' ')[0]}</strong> 
                    {' ' + act.formatted.text.split(' ').slice(1).join(' ')}
                  </span>
               </div>
               <div style={styles.actMeta}>
                  {timeAgo(act.date)}
               </div>
               {act.formatted.comment && (
                   <div style={styles.commentBubble}>{act.formatted.comment}</div>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});