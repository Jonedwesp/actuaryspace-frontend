import React, { useState, useRef, useEffect } from "react";
import { getCFColorClass } from "../utils/trelloUtils.js";

function CustomDropdown({ field, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selectedClass = getCFColorClass(field, value);

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <div
        className={`cf-select-box ${selectedClass}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", userSelect: "none" }}
      >
        <span>{value || "(None)"}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
      </div>

      {isOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px",
          background: "#fff", border: "1px solid #dadce0", borderRadius: "6px",
          boxShadow: "0 8px 16px rgba(0,0,0,0.15)", zIndex: 10000,
          maxHeight: "300px", overflowY: "auto"
        }}>
          <div
            className="cf-grey-light"
            style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #f1f3f4" }}
            onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.95)"}
            onMouseLeave={e => e.currentTarget.style.filter = "none"}
            onClick={() => { onChange(""); setIsOpen(false); }}
          >
            (None)
          </div>
          {options.map(o => {
            const optClass = getCFColorClass(field, o);
            return (
              <div
                key={o}
                className={optClass}
                style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #f1f3f4" }}
                onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.95)"}
                onMouseLeave={e => e.currentTarget.style.filter = "none"}
                onClick={() => { onChange(o); setIsOpen(false); }}
              >
                {o}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomDropdown;
