import React, { useState, useMemo } from 'react';
import blueprint1 from './assets/blueprint-1.mp4';
import blueprint2 from './assets/blueprint-2.mp4';
import blueprint3 from './assets/blueprint-3.mp4';

const BlueprintVideo = ({ isPlaying }) => {
  const [videoIndex, setVideoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const playlist = useMemo(() => [blueprint1, blueprint2, blueprint3], []);

  const handleVideoEnd = () => {
    setIsLoading(true);
    setVideoIndex((prev) => (prev + 1) % playlist.length);
  };

  if (!isPlaying) return null;

  return (
    <div className="video-loader-container" style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent' }}>
      {isLoading && (
        <div className="spinner-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'grid', placeItems: 'center', zIndex: 5 }}>
          <div className="loading-spinner" style={{ width: '24px', height: '24px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      )}
      <video
        key={playlist[videoIndex]}
        autoPlay
        muted
        playsInline
        ref={(el) => {
          if (el && !el.defaultMuted) {
            el.defaultMuted = true;
            el.muted = true;
          }
        }}
        onLoadedData={(e) => {
          setIsLoading(false);
          e.target.play().catch(() => {});
        }}
        onCanPlay={(e) => {
          setIsLoading(false);
          e.target.play().catch(() => {});
        }}
        onPlaying={() => setIsLoading(false)}
        onEnded={handleVideoEnd}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      >
        <source src={playlist[videoIndex]} type="video/mp4" />
      </video>
    </div>
  );
};

export default BlueprintVideo;