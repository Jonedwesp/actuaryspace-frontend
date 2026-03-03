import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

const pulseAnimation = {
  "v": "5.5.7", "fr": 60, "ip": 0, "op": 60, "w": 100, "h": 100, "nm": "Pulse", "ddd": 0, "assets": [], 
  "layers": [{ "ddd": 0, "ind": 1, "ty": 4, "nm": "Shape", "sr": 1, "ks": { "o": { "a": 1, "k": [{ "t": 0, "s": [30] }, { "t": 30, "s": [100] }, { "t": 60, "s": [30] }] } }, "shapes": [] }] 
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
    let charIndex = 0;
    setDisplayText("");
    
    const typingInterval = setInterval(() => {
      if (charIndex < currentStepText.length) {
        setDisplayText((prev) => prev + currentStepText.charAt(charIndex));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 40);

    return () => clearInterval(typingInterval);
  }, [statusIndex, isLiveCallActive]);

  return (
    <div className={`storyteller-container ${isLiveCallActive ? 'active' : 'idle'}`}>
      <div className="story-header">
        <div className={`status-dot ${isLiveCallActive ? 'live' : ''}`} />
        <span className="story-label">STORYTELLER AI</span>
      </div>

      {!isLiveCallActive ? (
        <div className="story-idle-content">
          <p>Awaiting live audio context...</p>
        </div>
      ) : (
        <div className="story-active-content">
          <div className="lottie-wrap">
            <Lottie animationData={pulseAnimation} loop={true} />
          </div>
          <div className="typewriter-wrap">
            <span className="typewriter-text">{displayText}</span>
            <span className={`cursor ${isTyping ? 'visible' : 'blink'}`}>|</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .storyteller-container {
          padding: 12px;
          border-radius: 12px;
          background: #f8f9fa;
          border: 1px solid #dadce0;
          transition: all 0.4s ease;
          min-height: 80px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .storyteller-container.active {
          background: #e8f0fe;
          border: 1px solid #1a73e8;
          box-shadow: 0 2px 10px rgba(26, 115, 232, 0.15);
        }
        .story-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9aa0a6;
        }
        .status-dot.live {
          background: #ea4335;
          box-shadow: 0 0 6px #ea4335;
          animation: pulse 2s infinite;
        }
        .story-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #5f6368;
        }
        .storyteller-container.active .story-label {
          color: #1a73e8;
        }
        .story-idle-content p {
          font-size: 12px;
          color: #80868b;
          font-style: italic;
          margin: 0;
        }
        .story-active-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lottie-wrap {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }
        .typewriter-wrap {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #1a73e8;
          line-height: 1.4;
          font-weight: 500;
        }
        .cursor.blink { animation: blink 1s infinite; opacity: 1; }
        .cursor.visible { opacity: 1; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default StorytellerMockup;