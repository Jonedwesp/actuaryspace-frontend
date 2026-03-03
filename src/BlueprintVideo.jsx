import React, { useState, useRef, useEffect, useMemo } from 'react';
import blueprint1 from './assets/blueprint-1.mp4';
import blueprint2 from './assets/blueprint-2.mp4';
import blueprint3 from './assets/blueprint-3.mp4';

const BlueprintVideo = ({ isPlaying }) => {
  const videoRef = useRef(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // 🛡️ Playlist is memoized to prevent infinite reload loops [cite: 1111]
  const playlist = useMemo(() => [blueprint1, blueprint2, blueprint3], []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      setIsLoading(true);
      // ⚡ Explicitly assign src and trigger load for immediate playback [cite: 1100, 1109]
      video.src = playlist[videoIndex];
      video.load();
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsLoading(false))
          .catch(err => {
            console.error("Blueprint playback failed:", err);
            setIsLoading(false);
          });
      }
    } else {
      video.pause();
      video.currentTime = 0;
      setIsLoading(false);
    }
  }, [isPlaying, videoIndex, playlist]);

  const handleVideoEnd = () => {
    // 🔄 Cycle through the three blueprint videos [cite: 1109]
    setVideoIndex((prev) => (prev + 1) % playlist.length);
  };

  return (
    <div className="video-loader-container" style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent' }}>
      {isLoading && (
        <div className="spinner-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}>
          <div className="loading-spinner"></div>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onPlaying={() => setIsLoading(false)}
        onEnded={handleVideoEnd}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
};

export default BlueprintVideo;