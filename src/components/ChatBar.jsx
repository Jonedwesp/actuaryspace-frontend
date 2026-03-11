import React from "react";

export function ChatBar({
  currentView,
  gchatSelectedSpace,
  pendingUpload, setPendingUpload,
  chatBarRef,
  inputValue, setInputValue,
  isRecording,
  handleSend,
  handleAutoGrow,
  startRecording,
  stopRecording,
  showPlusMenu, setShowPlusMenu,
  fileInputRef,
  chatTextareaRef,
}) {
  if (!(currentView.app === "gchat" && gchatSelectedSpace)) return null;

  return (
    <div style={{ display: "flex", width: "100%", background: "#fff", flexShrink: 0, borderTop: "1px solid #ddd" }}>

      {currentView.app === "gchat" && (
        <div style={{ width: "30%", borderRight: "1px solid #ddd", flexShrink: 1 }}></div>
      )}

      <div
        ref={chatBarRef}
        className={`chat-bar ${pendingUpload ? "has-file" : ""}`}
        style={{
          width: currentView.app === "gchat" ? "73%" : "100%",
          flexShrink: 1,
          borderTop: "none",
          margin: currentView.app === "gchat" ? "12px 24px 12px 12px" : undefined
        }}
      >
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

          {/* TEXT AREA */}
          <textarea
            ref={chatTextareaRef}
            className="chat-textarea"
            placeholder={isRecording ? "Recording audio..." : "History is on"}
            rows={1}
            value={inputValue}
            disabled={isRecording}
            onChange={(e) => setInputValue(e.target.value)}
            onInput={(e) => handleAutoGrow(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{ flex: 1, minHeight: "40px", paddingTop: "10px", marginBottom: "2px" }}
          />

          {/* RIGHT ACTIONS */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "4px", paddingLeft: "4px" }}>

            {/* SEND or MIC */}
            {inputValue.trim() || pendingUpload ? (
              <button
                className="send-btn"
                onClick={handleSend}
                aria-label="Send"
                style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  display: "grid", placeItems: "center",
                  border: "none", background: "#000",
                  cursor: "pointer", color: "white"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"
                  fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            ) : (
              (currentView.app === "gchat" && gchatSelectedSpace) && (
                <button
                  className={`mic-btn ${isRecording ? "recording" : ""}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? "Stop Recording" : "Record Voice Note"}
                  style={{
                    border: "none",
                    background: isRecording ? "#fce8e6" : "transparent",
                    color: isRecording ? "#ea4335" : "#5f6368",
                    borderRadius: "50%",
                    width: "34px", height: "34px",
                    cursor: "pointer",
                    display: "grid", placeItems: "center",
                    transition: "all 0.2s ease"
                  }}
                >
                  {isRecording ? (
                    <div style={{ width: "12px", height: "12px", background: "#ea4335", borderRadius: "2px" }} />
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

            {/* PLUS BUTTON */}
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
                    width: "34px", height: "34px", borderRadius: "50%",
                    border: "1px solid #ddd", background: "transparent",
                    fontSize: "22px", color: "#5f6368", fontWeight: "300",
                    display: "grid", placeItems: "center", cursor: "pointer"
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
  );
}

export default ChatBar;
