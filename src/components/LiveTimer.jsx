import { useState, useEffect } from "react";

function LiveTimer({ startTime, duration }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const extractVal = (v) => {
    if (!v) return 0;
    if (typeof v === "object") return v.text || v.number || v.value?.text || v.value?.number || "0";
    return v;
  };

  // 1. Calculate total base minutes across ALL buckets
  let baseMinutes = 0;
  const durStr = String(extractVal(duration));
  if (durStr.startsWith("{")) {
    try {
      const parsed = JSON.parse(durStr);
      baseMinutes = Object.values(parsed).reduce((sum, val) => sum + parseFloat(val), 0);
    } catch(e) {}
  } else {
    baseMinutes = parseFloat(durStr) || 0;
  }
  if (baseMinutes > 1000000) baseMinutes = 0;

  // 2. Add current active session
  let currentSessionMinutes = 0;
  if (startTime) {
    const startStr = String(extractVal(startTime));
    const [startTsStr] = startStr.split("|");
    const start = parseFloat(startTsStr);
    if (start > 1000000000000) {
      const diff = Math.max(0, now - start);
      currentSessionMinutes = diff / 1000 / 60;
    }
  }

  const totalMins = Math.floor(baseMinutes + currentSessionMinutes);
  let displayTime = `${totalMins}m`;
  if (totalMins >= 60) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    displayTime = m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return <span>⏱ {displayTime}</span>;
}

export default LiveTimer;
