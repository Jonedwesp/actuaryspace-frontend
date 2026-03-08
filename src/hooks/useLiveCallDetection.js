import { useState, useRef, useEffect, useMemo } from "react";

export function useLiveCallDetection({ setSelectedEvent }) {
  const [isLiveCallActive, setIsLiveCallActive] = useState(false);
  const [workstationUrl, setWorkstationUrl] = useState(null);
  const workstationIframeRef = useRef(null);
  const [statusText, setStatusText] = useState("");
  const [taskIndex, setTaskIndex] = useState(0);

  const aiTasks = useMemo(() => [
    "Analyzing Actuarial Risk Patterns...",
    "Drafting: Funeral Policies for Dummies...",
    "Calculating: IBNR Reserves...",
    "Reviewing: Claim Triangulations..."
  ], []);

  // Detect Arc split view opening & closing
  useEffect(() => {
    let lastWidth = window.innerWidth;
    let splitViewArmed = false;
    let armTimer = null;

    const handleArmed = () => {
      splitViewArmed = true;
      clearTimeout(armTimer);
      armTimer = setTimeout(() => { splitViewArmed = false; }, 5000);
    };

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (isLiveCallActive && currentWidth > lastWidth + 200) {
        setIsLiveCallActive(false);
      }
      if (!isLiveCallActive && splitViewArmed && currentWidth < lastWidth - 200) {
        setIsLiveCallActive(true);
        window.dispatchEvent(new CustomEvent("googleMeetLaunched"));
        splitViewArmed = false;
      }
      lastWidth = currentWidth;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('armedForSplitView', handleArmed);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('armedForSplitView', handleArmed);
      clearTimeout(armTimer);
    };
  }, [isLiveCallActive]);

  // Workstation pane + Google Meet launch listener
  useEffect(() => {
    const handleWorkstation = (e) => {
      const incomingUrl = e.detail;
      setWorkstationUrl(incomingUrl);
      if (incomingUrl && incomingUrl.includes("meet.google.com")) {
        setTimeout(() => setIsLiveCallActive(true), 4000);
      } else {
        setIsLiveCallActive(false);
      }
      setSelectedEvent(null);
    };
    window.addEventListener("openWorkstationPane", handleWorkstation);
    return () => window.removeEventListener("openWorkstationPane", handleWorkstation);
  }, []);

  // AI task typing animation
  useEffect(() => {
    if (!isLiveCallActive) { setStatusText(""); return; }
    let currentTask = aiTasks[taskIndex] || aiTasks[0];
    let charIndex = 0;
    let timeoutId;
    setStatusText("");
    const typeInterval = setInterval(() => {
      if (charIndex < currentTask.length) {
        setStatusText(currentTask.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        timeoutId = setTimeout(() => setTaskIndex((prev) => (prev + 1) % aiTasks.length), 2000);
      }
    }, 50);
    return () => { clearInterval(typeInterval); clearTimeout(timeoutId); };
  }, [isLiveCallActive, taskIndex, aiTasks]);

  return { isLiveCallActive, setIsLiveCallActive, statusText, workstationUrl, workstationIframeRef };
}
