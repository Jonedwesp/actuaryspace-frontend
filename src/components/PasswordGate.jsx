import React from "react";

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "";

function PasswordGate({ children, persona }) {
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
          ActuarySpace — {persona?.toUpperCase() === "YOLANDIE" ? "Yolandie" : persona?.toUpperCase() === "SIYA" ? "Siya" : "Unknown"}
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

export default PasswordGate;
