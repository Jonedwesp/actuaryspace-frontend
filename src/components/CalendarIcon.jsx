import React from "react";

const CalendarIcon = () => {
  const today = new Date().getDate();
  return (
    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <clipPath id="cal-clip">
        <path d="M 20 0 H 80 A 20 20 0 0 1 100 20 V 100 H 20 A 20 20 0 0 1 0 80 V 20 A 20 20 0 0 1 20 0 Z" />
      </clipPath>
      <g clipPath="url(#cal-clip)">
        <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
        <rect x="0" y="0" width="26" height="100" fill="#4285F4" />
        <rect x="0" y="0" width="100" height="26" fill="#4285F4" />
        <rect x="74" y="0" width="26" height="74" fill="#FBBC05" />
        <rect x="0" y="74" width="74" height="26" fill="#34A853" />
        <polygon points="74,100 100,74 100,100" fill="#EA4335" />
        <rect x="26" y="26" width="48" height="48" fill="#ffffff" />
      </g>
      <text x="50" y="64" fontSize="38" fontWeight="bold" fontFamily="'Google Sans', Roboto, Arial, sans-serif" fill="#4285F4" textAnchor="middle">
        {today}
      </text>
    </svg>
  );
};

export default CalendarIcon;
