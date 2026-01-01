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
      setDuration(video.duration);
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
        <div className="space-y-2">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPlayingChange(!isPlaying)}
              className="flex-1"
            >
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onMutedChange(!isMuted)}
              className="flex-1"
            >
              {isMuted ? "Unmute" : "Mute"}
            </Button>
          </div>

          {/* Seek Bar */}
          {duration > 0 && (
            <div className="space-y-1">
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
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border-0"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{formatTime(localTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}
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
