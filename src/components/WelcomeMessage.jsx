import React, { useState, useEffect } from "react";

const WelcomeMessage = () => {
  const line1 = "Hi Siya";
  const line2 = "Where should we start?";
  const [txt1, setTxt1] = useState("");
  const [txt2, setTxt2] = useState("");
  useEffect(() => {
    let i = 0, j = 0, done1 = false;
    const tick = setInterval(() => {
      if (!done1) {
        i++;
        setTxt1(line1.slice(0, i));
        if (i >= line1.length) done1 = true;
      } else {
        j++;
        setTxt2(line2.slice(0, j));
        if (j >= line2.length) clearInterval(tick);
      }
    }, 35);
    return () => clearInterval(tick);
  }, []);
  return (
    <div style={{ textAlign: "left", padding: "0 48px", transform: "translateY(-32px)" }}>
      <div style={{ fontSize: "18px", color: "#bdc1c6", fontWeight: 400, marginBottom: "1px", fontFamily: "'Inter', sans-serif", minHeight: "26px" }}>{txt1}</div>
      <div style={{ fontSize: "30px", color: "#bdc1c6", fontWeight: 500, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.3px", minHeight: "40px" }}>{txt2}</div>
    </div>
  );
};

export default WelcomeMessage;
