import React, { useState, useEffect } from 'react';

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
          <svg className="notebook-doodle" viewBox="0 0 50 50">
            <path className="path" d="M25 5 Q25 25 45 25 Q25 25 25 45 Q25 25 5 25 Q25 25 25 5 Z" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
          <div className="typewriter-wrap">
            <span className="typewriter-text">{displayText}</span>
          </div>
        </div>
      )}

      <style>{`
        .storyteller-container {
          padding: 0px 4px;
          min-height: 0px;
        }
        .story-active-content {
          display: flex;
          align-items: center;
          margin-top: 4px;
          gap: 8px;
        }
     .notebook-doodle {
          animation: rotate 6s linear infinite, breathe 2s ease-in-out infinite;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          transform-origin: center;
        }

        @keyframes breathe {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        .notebook-doodle .path {
          stroke: #5f6368;
          stroke-linecap: round;
          animation: dash 1.5s ease-in-out infinite, colorShift 4s infinite;
        }

        .typewriter-wrap {
          font-family: Arial, sans-serif;
          font-size: 13px;
          color: #000000;
          font-style: italic;
          line-height: 1.4;
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        
        @keyframes rotate {
          100% { transform: rotate(360deg); }
        }
        
        @keyframes dash {
          0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
          50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
          100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
        }

        @keyframes colorShift {
          0%, 100% { stroke: #5f6368; }
          50% { stroke: #1a73e8; }
        }
      `}</style>
    </div>
  );
};

export default StorytellerMockup;