import { useState, useRef, useEffect } from "react";

const MiddleAppSpring = ({ appKey, children }) => {
  const isOpen = appKey !== 'none';
  const [phase, setPhase] = useState(isOpen ? 'in' : 'hidden');
  const [displayKey, setDisplayKey] = useState(appKey);
  const [displayChildren, setDisplayChildren] = useState(children);
  const timerRef = useRef(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    clearTimeout(timerRef.current);
    if (isOpen) {
      setDisplayKey(appKey);
      setDisplayChildren(children);
      setPhase('in');
    } else {
      setPhase('out');
      timerRef.current = setTimeout(() => setPhase('hidden'), 160);
    }
    return () => clearTimeout(timerRef.current);
  }, [appKey]); // eslint-disable-line

  // Keep children fresh while open so live data updates show
  useEffect(() => {
    if (isOpen) setDisplayChildren(children);
  }, [children, isOpen]); // eslint-disable-line

  if (phase === 'hidden') return null;
  return (
    <div
      key={displayKey}
      className={`middle-app-${phase}`}
      style={{ height: '100%', transformOrigin: 'center' }}
    >
      {displayChildren}
    </div>
  );
};

export default MiddleAppSpring;
