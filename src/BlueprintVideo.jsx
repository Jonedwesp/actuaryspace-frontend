import React, { useState, useEffect, useMemo } from 'react';
import blueprint1 from './assets/blueprint-1.mp4';
import blueprint2 from './assets/blueprint-2.mp4';
import blueprint3 from './assets/blueprint-3.mp4';
import blueprint4 from './assets/blueprint-4.mp4';
import blueprint5 from './assets/blueprint-5.mp4';
import blueprint6 from './assets/blueprint-6.mp4';
import blueprint7 from './assets/blueprint-7.mp4';
import blueprint8 from './assets/blueprint-8.mp4';
import blueprint9 from './assets/blueprint-9.mp4';
import blueprint10 from './assets/blueprint-10.mp4';

const BlueprintVideo = ({ isPlaying }) => {
  const [videoIndex, setVideoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = React.useRef(null);

  const playlist = useMemo(() => [blueprint1, blueprint2, blueprint3, blueprint4, blueprint5, blueprint6, blueprint7, blueprint8, blueprint9, blueprint10], []);

  // Force the video to explicitly load and play whenever the index changes
  useEffect(() => {
    if (videoRef.current && isPlaying) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.load();
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, [videoIndex, isPlaying]);

  // 🛡️ Fail-safe: clear video spinner if local proxy hangs the network events
  useEffect(() => {
    if (isLoading) {
      const t = setTimeout(() => setIsLoading(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  const handleVideoEnd = () => {
    setIsLoading(true);
    setVideoIndex((prev) => (prev + 1) % playlist.length);
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
        ref={videoRef}
        src={playlist[videoIndex]}
        autoPlay
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setIsLoading(false)}
        onPlaying={() => setIsLoading(false)}
        onEnded={handleVideoEnd}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
};

export default BlueprintVideo;