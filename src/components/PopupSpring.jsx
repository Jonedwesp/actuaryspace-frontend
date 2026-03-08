import { useState, useRef, useEffect } from "react";

const PopupSpring = ({ show, children, style = {}, className = '', origin = 'top right', onClick }) => {
  const [phase, setPhase] = useState(() => show ? 'in' : 'hidden');
  const timerRef = useRef(null);
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    if (show) {
      clearTimeout(timerRef.current);
      setPhase('in');
    } else {
      setPhase('out');
      timerRef.current = setTimeout(() => setPhase('hidden'), 150);
    }
    return () => clearTimeout(timerRef.current);
  }, [show]);
  if (phase === 'hidden') return null;
  return (
    <div
      className={`popup-anim-${phase}${className ? ' ' + className : ''}`}
      style={{ transformOrigin: origin, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default PopupSpring;
