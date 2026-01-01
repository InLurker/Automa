import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRef, useEffect, useState } from "react";

interface ControlMediaPreviewProps {
  mediaUrl: string;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  onPlayingChange: (playing: boolean) => void;
  onMutedChange: (muted: boolean) => void;
  onTimeChange: (time: number) => void;
}

export function ControlMediaPreview({
  mediaUrl,
  isPlaying = true,
  isMuted = false,
  currentTime = 0,
  onPlayingChange,
  onMutedChange,
  onTimeChange,
}: ControlMediaPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [duration, setDuration] = useState(0);
  const [localTime, setLocalTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isSeeking = useRef(false);

  // Detect media type
  const detectMediaType = (url: string): 'image' | 'video' | 'gif' | null => {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.match(/\.(mp4|webm|ogg|mov)(\?|#|\/|$)/i) || url.startsWith('data:video/')) {
      return 'video';
    }
    // Match .gif with optional trailing /, ?, or #
    if (lower.match(/\.gif(\/|\?|#|$)/i) || url.startsWith('data:image/gif')) {
      return 'gif';
    }
    return 'image';
  };

  const mediaType = detectMediaType(mediaUrl);
  const isVideo = mediaType === 'video';
  const isGif = mediaType === 'gif';

  // Sync video element with controls
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, isVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;
    video.muted = isMuted;
  }, [isMuted, isVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo || isSeeking.current) return;
    
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      video.currentTime = currentTime;
    }
  }, [currentTime, isVideo]);

  // Reset loading state when media URL changes
  useEffect(() => {
    if (mediaUrl) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [mediaUrl]);

  // Handle video events
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0; // Reset to start when importing new media
      
      // Sync video element with current playing state
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
      
      setDuration(video.duration);
      setLocalTime(0);
      onTimeChange(0);
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && !isSeeking.current) {
      setLocalTime(video.currentTime);
      onTimeChange(video.currentTime);
    }
  };

  const handleSeekStart = () => {
    isSeeking.current = true;
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setLocalTime(newTime);
    const video = videoRef.current;
    if (video) {
      video.currentTime = newTime;
    }
  };

  const handleSeekEnd = (value: number[]) => {
    const newTime = value[0];
    isSeeking.current = false;
    onTimeChange(newTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!mediaUrl) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Media Preview</Label>
        <div className="rounded-md border border-dashed border-border/50 p-8 text-center">
          <p className="text-xs text-muted-foreground">No media loaded</p>
        </div>
      </div>
    );
  }

  // Don't show preview if media failed to load
  if (hasError) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Media Preview</Label>
      
      {/* Preview */}
      <div className="relative rounded-md overflow-hidden border border-border bg-black min-h-[120px] flex items-center justify-center">
        {isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            loop
            playsInline
            muted={isMuted}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onError={handleVideoError}
            className="w-full h-auto"
            style={{ opacity: isLoading ? 0 : 1 }}
          />
        ) : (
          <img
            ref={imageRef}
            src={mediaUrl}
            alt="Preview"
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="w-full h-auto"
            style={{ opacity: isLoading ? 0 : 1 }}
          />
        )}
        {/* Note: GIFs animate automatically as img elements */}
        
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="relative w-12 h-12">
              {/* Spinning circle */}
              <div className="absolute inset-0 border-4 border-muted rounded-full animate-spin border-t-foreground"></div>
            </div>
          </div>
        )}
      </div>

      {/* Video Controls */}
      {isVideo && !isLoading && (
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={() => onPlayingChange(!isPlaying)}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-accent/50 transition-colors flex-shrink-0"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <rect x="4" y="3" width="2" height="8" fill="currentColor" rx="0.5"/>
                <rect x="8" y="3" width="2" height="8" fill="currentColor" rx="0.5"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M4 3l7 4-7 4V3z" fill="currentColor"/>
              </svg>
            )}
          </button>

          {/* Timeline */}
          {duration > 0 && (
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums flex-shrink-0">{formatTime(localTime)}</span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={localTime}
                onChange={(e) => handleSeek([parseFloat(e.target.value)])}
                onMouseDown={handleSeekStart}
                onMouseUp={() => handleSeekEnd([localTime])}
                onTouchStart={handleSeekStart}
                onTouchEnd={() => handleSeekEnd([localTime])}
                className="flex-1 min-w-0 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border-0"
              />
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums flex-shrink-0">{formatTime(duration)}</span>
            </div>
          )}

          {/* Mute/Unmute Button */}
          <button
            type="button"
            onClick={() => onMutedChange(!isMuted)}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-accent/50 transition-colors flex-shrink-0"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 3L4.5 5.5H2.5v3H4.5L7 11V3z" fill="currentColor"/>
                <path d="M9.5 5.5l3 3M12.5 5.5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 3L4.5 5.5H2.5v3H4.5L7 11V3z" fill="currentColor"/>
                <path d="M9 5.5c.5.5.5 2.5 0 3M10.5 4c1 1 1 5 0 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      )}
      
      {/* Loading indicator for controls */}
      {isVideo && isLoading && (
        <div className="text-center text-xs text-muted-foreground py-2">
          Loading video...
        </div>
      )}
    </div>
  );
}
