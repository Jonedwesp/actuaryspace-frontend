import React, { useRef, useEffect, useState, useCallback } from "react";

export default function DonnaBubble({ transcription, isListening, showActions, onApprove, onReject, onClose }) {
  const containerRef = useRef(null);
  const [isExiting, setIsExiting] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const exitTimerRef = useRef(null);

  const shouldShow = !!transcription;

  const dismiss = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setAnimDone(false);
    exitTimerRef.current = setTimeout(() => {
      setIsExiting(false);
      onClose();
    }, 320);
  }, [isExiting, onClose]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        dismiss();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      clearTimeout(exitTimerRef.current);
    };
  }, [dismiss]);

  if (!shouldShow && !isExiting) return null;

  return (
    <div
      ref={containerRef}
      onAnimationEnd={() => { if (!isExiting) setAnimDone(true); }}
      style={{
        ...styles.container,
        transformOrigin: "top left",
        animation: isExiting
          ? "donnaCollapse 0.25s cubic-bezier(0.4, 0, 1, 1) forwards"
          : animDone
            ? "none"
            : "donnaExpand 0.45s cubic-bezier(0.34, 1.5, 0.64, 1) forwards",
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

      <div style={styles.transcription}>
        {transcription}
      </div>

      {showActions && (
        <div style={styles.actionContainer}>
          <button onClick={onReject} style={{ ...styles.button, ...styles.rejectButton }}>Reject</button>
          <button 
            onClick={onApprove} 
            style={{ ...styles.button, ...styles.approveButton }}
          >
            {transcription.toLowerCase().includes("review") ? "Open Review" : "Approve"}
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
