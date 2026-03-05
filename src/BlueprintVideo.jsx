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
  const videoRef = React.useRef(null);

  const playlist = useMemo(() => [blueprint1, blueprint2, blueprint3, blueprint4, blueprint5, blueprint6, blueprint7, blueprint8, blueprint9, blueprint10], []);

  // 1. Force the browser to continuously play the videos smoothly without network interruptions
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.muted = true;
    vid.defaultMuted = true;

    if (isPlaying) {
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Autoplay blocked, retrying:", error);
          setTimeout(() => { if (videoRef.current) videoRef.current.play().catch(()=>{}) }, 100);
        });
      }
    } else {
      vid.pause();
    }
  }, [videoIndex, isPlaying]);

  // 2. Loop seamlessly to the next video
  const handleVideoEnd = () => {
    setVideoIndex((prev) => (prev + 1) % playlist.length);
  };

  return (
    <div className="video-loader-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'transparent', opacity: isPlaying ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: isPlaying ? 'auto' : 'none' }}>
      <video
        ref={videoRef}
        src={playlist[videoIndex]}
        autoPlay={isPlaying}
        muted
        playsInline
        preload="auto"
        onEnded={handleVideoEnd}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {/* Silent hidden video preloads the NEXT clip in the background so there's 0 delay between loops */}
      <video src={playlist[(videoIndex + 1) % playlist.length]} preload="auto" style={{ display: 'none' }} />
    </div>
  );
};

export default BlueprintVideo;