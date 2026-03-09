import React from "react";

export default function DonnaBubble({ transcription, isListening, showActions, onApprove, onReject, onClose }) {
  if (!transcription && !isListening) return null;

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes donnaPulse {
            0% { box-shadow: 0 0 0 0 rgba(234, 67, 53, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(234, 67, 53, 0); }
            100% { box-shadow: 0 0 0 0 rgba(234, 67, 53, 0); }
          }
        `}
      </style>
      
      <button onClick={onClose} style={styles.closeButton} title="Close">×</button>

      <div style={styles.header}>
        <div style={{
          ...styles.indicator,
          ...(isListening ? styles.pulsing : styles.idle)
        }}></div>
        <span style={styles.title}>Agent Donna</span>
      </div>
      
   <div style={styles.transcription}>
        {isListening && !transcription ? "Listening..." : transcription}
      </div>

      {showActions && (
        <div style={styles.actionContainer}>
          <button onClick={onReject} style={{...styles.button, ...styles.rejectButton}}>Reject</button>
          <button onClick={onApprove} style={{...styles.button, ...styles.approveButton}}>Approve</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",      // 👈 CHANGE THIS from absolute to fixed
    bottom: "100px",        // 👈 Move it up a bit so it's not behind the chat bar
    right: "40px",          // 👈 Move it to the right side of the screen
    width: "320px",
    backgroundColor: "#ffffff",
    border: "1px solid #dadce0",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)", // Make the shadow stronger
    zIndex: 9999,           // 👈 CRITICAL: Force it to the very front
    fontFamily: "'Google Sans', Roboto, sans-serif"
  },
  closeButton: {
    position: "absolute",
    top: "8px",
    right: "12px",
    background: "transparent",
    border: "none",
    fontSize: "18px",
    color: "#5f6368",
    cursor: "pointer",
    padding: "4px"
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px"
  },
  indicator: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
  },
  pulsing: {
    backgroundColor: "#ea4335",
    animation: "donnaPulse 1.5s infinite"
  },
  idle: {
    backgroundColor: "#dadce0"
  },
  title: {
    fontWeight: "600",
    fontSize: "14px",
    color: "#3c4043"
  },
  transcription: {
    fontSize: "14px",
    color: "#5f6368",
    marginBottom: "16px",
    minHeight: "20px",
    fontStyle: "italic",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  },
  actionContainer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px"
  },
  button: {
    padding: "6px 16px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500"
  },
  approveButton: {
    backgroundColor: "#34a853",
    color: "white"
  },
  rejectButton: {
    backgroundColor: "#ea4335",
    color: "white"
  }
};