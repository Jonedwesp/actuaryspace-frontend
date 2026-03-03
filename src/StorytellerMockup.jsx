import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

// A clean "thinking dots" animation JSON for the demo
const pulseAnimation = {
  "v": "5.5.2", "fr": 60, "ip": 0, "op": 60, "w": 100, "h": 100, "nm": "Loading", "ddd": 0, "assets": [],
  "layers": [
    { "ddd": 0, "ind": 1, "ty": 4, "nm": "Dot 3", "sr": 1, "ks": { "o": { "a": 1, "k": [{ "t": 20, "s": [30] }, { "t": 35, "s": [100] }, { "t": 50, "s": [30] }] }, "p": { "a": 0, "k": [80, 50, 0] } }, "shapes": [{ "ty": "el", "sz": { "a": 0, "k": [20, 20] }, "p": { "a": 0, "k": [0, 0] } }, { "ty": "fl", "c": { "a": 0, "k": [0, 0.83, 1, 1] } }] },
    { "ddd": 0, "ind": 2, "ty": 4, "nm": "Dot 2", "sr": 1, "ks": { "o": { "a": 1, "k": [{ "t": 10, "s": [30] }, { "t": 25, "s": [100] }, { "t": 40, "s": [30] }] }, "p": { "a": 0, "k": [50, 50, 0] } }, "shapes": [{ "ty": "el", "sz": { "a": 0, "k": [20, 20] }, "p": { "a": 0, "k": [0, 0] } }, { "ty": "fl", "c": { "a": 0, "k": [0, 0.83, 1, 1] } }] },
    { "ddd": 0, "ind": 3, "ty": 4, "nm": "Dot 1", "sr": 1, "ks": { "o": { "a": 1, "k": [{ "t": 0, "s": [30] }, { "t": 15, "s": [100] }, { "t": 30, "s": [30] }] }, "p": { "a": 0, "k": [20, 50, 0] } }, "shapes": [{ "ty": "el", "sz": { "a": 0, "k": [20, 20] }, "p": { "a": 0, "k": [0, 0] } }, { "ty": "fl", "c": { "a": 0, "k": [0, 0.83, 1, 1] } }] }
  ]
};

const StorytellerMockup = ({ isLiveCallActive }) => {
  const [statusIndex, setStatusIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  const statusSteps = [
    "Extracting keywords from Meet...",
    "Drafting: Funeral Policies for Dummies...",
    "Analyzing Actuarial Risk Patterns...",
    "Generating visual slide structure...",
    "Finalizing training manual draft..."
  ];

  useEffect(() => {
    if (!isLiveCallActive) {
      setStatusIndex(0);
      setDisplayText("");
      return;
    }

    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusSteps.length);
      setIsTyping(true);
    }, 8500);

    return () => clearInterval(interval);
  }, [isLiveCallActive]);

 useEffect(() => {
    if (!isLiveCallActive) return;

    let currentStepText = statusSteps[statusIndex];
    let localText = "";
    setDisplayText("");
    
    const typingInterval = setInterval(() => {
      if (localText.length < currentStepText.length) {
        localText += currentStepText.charAt(localText.length);
        setDisplayText(localText);
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 40);

    return () => clearInterval(typingInterval);
  }, [statusIndex, isLiveCallActive]);

return (
    <div className="storyteller-container">
      {!isLiveCallActive ? null : (
        <div className="story-active-content">
          <div className="typewriter-wrap">
            <span className="typewriter-text">{displayText}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .storyteller-container {
          padding: 0px 4px;
          min-height: 0px;
        }
        .story-active-content {
          display: flex;
          align-items: center;
          margin-top: 4px;
        }
        .typewriter-wrap {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #5f6368;
          font-style: italic;
          line-height: 1.4;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

export default StorytellerMockup;