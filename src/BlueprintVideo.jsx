import React, { useState, useEffect, useMemo } from 'react';
import blueprint1 from './assets/blueprint-1.mp4';
import blueprint2 from './assets/blueprint-2.mp4';
import blueprint3 from './assets/blueprint-3.mp4';

const BlueprintVideo = ({ isPlaying }) => {
  const [videoIndex, setVideoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const playlist = useMemo(() => [blueprint1, blueprint2, blueprint3], []);

  // 🛡️ Fail-safe: clear video spinner if local proxy hangs the network events
  useEffect(() => {
    if (isLoading) {
      const t = setTimeout(() => setIsLoading(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  const handleVideoEnd = () => {
    setIsLoading(true);
    setVideoIndex((prev) => {
      const next = Math.floor(Math.random() * playlist.length);
      return playlist.length > 1 && next === prev ? (next + 1) % playlist.length : next;
    });
  };

  if (!isPlaying) return null;

  return (
    <div className="video-loader-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'transparent' }}>
      {isLoading && (
        <div className="spinner-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'grid', placeItems: 'center', zIndex: 5 }}>
          <div className="loading-spinner" style={{ width: '24px', height: '24px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      )}
      <video
        key={playlist[videoIndex]}
        src={playlist[videoIndex]}
        autoPlay
        muted
        playsInline
        preload="metadata"
        ref={(el) => {
          if (el) {
            el.defaultMuted = true;
            el.muted = true;
            const playPromise = el.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {});
            }
          }
        }}
        onLoadedData={() => setIsLoading(false)}
        onPlaying={() => setIsLoading(false)}
        onEnded={handleVideoEnd}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
};

export default BlueprintVideo;