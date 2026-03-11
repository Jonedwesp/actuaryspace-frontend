import React, { useRef, useEffect, useState } from "react";

export default function DonnaBubble({ transcription, show, showActions, onApprove, onReject, onClose, onRequestClose }) {
  const containerRef = useRef(null);
  const phaseRef = useRef("hidden"); // hidden | entering | visible | exiting
  const [phase, setPhase] = useState("hidden");
  const timerRef = useRef(null);

  const setP = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    if (show) {
      clearTimeout(timerRef.current);
      if (phaseRef.current === "hidden" || phaseRef.current === "exiting") {
        setP("entering");
      }
    } else {
      if (phaseRef.current !== "hidden") {
        clearTimeout(timerRef.current);
        setP("exiting");
        timerRef.current = setTimeout(() => {
          setP("hidden");
          onClose?.();
        }, 280);
      }
    }
    return () => clearTimeout(timerRef.current);
  }, [show]);

  useEffect(() => {
    if (phase === "hidden") return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (showActions) return;
        onRequestClose?.();
      }
    };
    const reg = setTimeout(() => document.addEventListener("mousedown", handleClick), 300);
    return () => {
      clearTimeout(reg);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [phase, showActions, onRequestClose]);

  if (phase === "hidden") return null;

  return (
    <div
      ref={containerRef}
      onAnimationEnd={() => { if (phaseRef.current === "entering") setP("visible"); }}
      style={{
        ...styles.container,
        transformOrigin: "top left",
        animation:
          phase === "entering" ? "donnaExpand 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" :
          phase === "exiting"  ? "donnaCollapse 0.28s cubic-bezier(0.4, 0, 1, 1) forwards" :
          "none",
      }}
    >
      <style>{`
        @keyframes donnaExpand {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes donnaCollapse {
          from { transform: scale(1); opacity: 1; }
          to   { transform: scale(0); opacity: 0; }
        }
      `}</style>

      <div style={styles.transcription}>{transcription}</div>

      {showActions && (
        <div style={styles.actionContainer}>
          <button onClick={onReject} style={{ ...styles.button, ...styles.rejectButton }}>Reject</button>
          <button onClick={onApprove} style={{ ...styles.button, ...styles.approveButton }}>
            {(transcription || "").toLowerCase().includes("review") ? "Open Review" : "Approve"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: "16px",
    left: "calc(20% - 12px)",
    width: "420px",
    backgroundColor: "#ffffff",
    border: "1px solid #8993a4",
    borderRadius: "12px",
    padding: "20px 24px",
    boxShadow: "0 8px 24px rgba(9,30,66,0.20), 0 2px 8px rgba(9,30,66,0.12), 0 0 1px rgba(9,30,66,0.31)",
    zIndex: 9999,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
  },
  transcription: {
    fontSize: "16px",
    color: "#202124",
    minHeight: "20px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  actionContainer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "16px",
  },
  button: {
    padding: "6px 16px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  approveButton: {
    backgroundColor: "#34a853",
    color: "white",
  },
  rejectButton: {
    backgroundColor: "#ea4335",
    color: "white",
  },
};
