import { useEffect, useRef, useMemo, useState } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";
import type { AutomaComponentProps } from "@/types/automa";

// Glyph generation helpers
function randomChar(script: string): number {
  switch (script) {
    case "alphabet":
      return 33 + Math.floor(Math.random() * 94);
    case "chinese":
      return 0x4e00 + Math.floor(Math.random() * 2000);
    case "japanese":
      return Math.random() < 0.6
        ? 0x3041 + Math.floor(Math.random() * 86)
        : 0x30a1 + Math.floor(Math.random() * 86);
    case "korean":
      return 0xac00 + Math.floor(Math.random() * 1115);
    default:
      return 63;
  }
}

// Parse hex color to rgba
function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex || !hex.startsWith("#")) return `rgba(255,255,255,${alpha})`;
  const h = hex.length === 4 ? hex.slice(1).replace(/./g, (c) => c + c) : hex.slice(1);
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ImageProjectionAutoma({
  values,
  width,
  height,
  isPaused,
}: AutomaComponentProps & { isPaused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameImageDataRef = useRef<ImageData | null>(null);
  const animationRef = useRef<number>();
  // Decoded GIF frames (avoids relying on browser animation quirks)
  const gifFramesRef = useRef<ImageData[]>([]);
  const gifDelaysRef = useRef<number[]>([]);
  const gifSizeRef = useRef<{ width: number; height: number } | null>(null);
  const gifFrameIndexRef = useRef(0);
  const gifLastTimeRef = useRef(0);
  const hiddenMediaContainerRef = useRef<HTMLDivElement | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isGif, setIsGif] = useState(false);
  
  // Video export state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Extract values FIRST (support both old imageUrl and new mediaUrl)
  const {
    cellSize = 16,
    script = "alphabet",
    baseColor = "#ffffff",
    baseBrightness = 0.3,
    mediaUrl = "",
    imageUrl = "", // Legacy support
    contrast = 1.5,
    invert = false,
    keepColor = false,
    _videoPlaying = true,
    _videoMuted = false,
    _videoCurrentTime = 0,
  } = values;
  
  // Contrast lookup table (memoized per contrast value)
  const contrastLUT = useMemo(() => {
    const lut = new Float32Array(256);
    const invContrast = 1 / contrast;
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.pow(i / 255, invContrast);
    }
    return lut;
  }, [contrast]);
  
  // Color string cache to avoid repeated string creation
  const colorCacheRef = useRef<Map<string, string>>(new Map());
  
  // Clear color cache when baseColor changes
  useEffect(() => {
    colorCacheRef.current.clear();
  }, [baseColor]);

  // Grid state
  const gridRef = useRef<{
    cols: number;
    rows: number;
    cell: number;
    chars: Uint32Array;
    charStrings: string[]; // Cache String.fromCodePoint results
  }>({
    cols: 0,
    rows: 0,
    cell: 16,
    chars: new Uint32Array(0),
    charStrings: [],
  });

  const url = mediaUrl || imageUrl;
  
  // Track whenever URL changes
  useEffect(() => {
    // URL changed - effect handled in load media hook
  }, [url]);

  // Detect if URL is video, gif, or image
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

  // Load media (image, gif, or video)
  useEffect(() => {
    // Reset refs
    mediaRef.current = null;
    frameImageDataRef.current = null;
    gifFramesRef.current = [];
    gifDelaysRef.current = [];
    gifSizeRef.current = null;
    gifFrameIndexRef.current = 0;
    gifLastTimeRef.current = 0;

    if (!url) {
      setIsVideo(false);
      setIsGif(false);
      return;
    }

    const mediaType = detectMediaType(url);

    // Video
    if (mediaType === "video") {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.volume = 0;

      video.onloadeddata = () => {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement("canvas");
        }
        offscreenCanvasRef.current.width = video.videoWidth;
        offscreenCanvasRef.current.height = video.videoHeight;
        offscreenCtxRef.current = offscreenCanvasRef.current.getContext("2d");

        mediaRef.current = video;
        if (_videoPlaying) {
          video.play().catch(() => {});
        }

        setIsVideo(true);
        setIsGif(false);
        updateTransformParams(video.videoWidth, video.videoHeight);
      };

      video.onerror = () => {
        mediaRef.current = null;
      };

      video.src = url;
      return;
    }

    // GIF - decode frames for reliable animation
    if (mediaType === "gif") {
      const loadGif = async () => {
        try {
          const response = await fetch(url);
          const buffer = await response.arrayBuffer();
          const gif = parseGIF(buffer);
          const frames = decompressFrames(gif, true);
          if (!frames.length) {
            setIsGif(false);
            setIsVideo(false);
            return;
          }

          const gifWidth = gif.lsd.width;
          const gifHeight = gif.lsd.height;
          gifSizeRef.current = { width: gifWidth, height: gifHeight };
          
          // Use raw delay values as milliseconds (gifuct-js provides delays ready to use)
          gifDelaysRef.current = frames.map((f) => {
            const d = typeof f.delay === "number" ? f.delay : 100;
            return Math.max(20, d); // Min 20ms to prevent too-fast animation
          });

          // Determine background color (for disposal type 2)
          let bgColor: [number, number, number, number] = [0, 0, 0, 0];
          if (gif.gct && typeof gif.lsd.bgColor === "number") {
            const idx = gif.lsd.bgColor;
            const color = gif.gct[idx];
            if (color && Array.isArray(color) && color.length >= 3) {
              bgColor = [color[0], color[1], color[2], 255];
            }
          }

          // Build full frames with disposal handling (optimized)
          const imageDataFrames: ImageData[] = [];
          const pixelCount = gifWidth * gifHeight;
          const compositeSize = pixelCount * 4;
          
          // Reusable composite buffer
          let composite = new Uint8ClampedArray(compositeSize);
          
          // Fill with background color
          for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            composite[idx] = bgColor[0];
            composite[idx + 1] = bgColor[1];
            composite[idx + 2] = bgColor[2];
            composite[idx + 3] = bgColor[3];
          }
          
          let prevDisposal = 0;
          let prevDims = frames[0]?.dims;
          let prevBackup: Uint8ClampedArray | null = null;

          frames.forEach((frame) => {
            // Apply disposal from previous frame
            if (prevDisposal === 2 && prevDims) {
              // Restore to background
              const { left, top, width, height } = prevDims;
              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  const idx = ((top + y) * gifWidth + (left + x)) * 4;
                  composite[idx] = bgColor[0];
                  composite[idx + 1] = bgColor[1];
                  composite[idx + 2] = bgColor[2];
                  composite[idx + 3] = bgColor[3];
                }
              }
            } else if (prevDisposal === 3 && prevBackup) {
              composite.set(prevBackup);
            }

            // Save backup for disposal 3
            if (frame.disposalType === 3) {
              prevBackup = new Uint8ClampedArray(composite);
            }

            // Apply current frame patch
            const { left, top, width, height } = frame.dims;
            const patch = frame.patch;
            
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const patchIdx = (y * width + x) * 4;
                const a = patch[patchIdx + 3];
                
                // Only draw non-transparent pixels
                if (a !== 0) {
                  const destIdx = ((top + y) * gifWidth + (left + x)) * 4;
                  composite[destIdx] = patch[patchIdx];
                  composite[destIdx + 1] = patch[patchIdx + 1];
                  composite[destIdx + 2] = patch[patchIdx + 2];
                  composite[destIdx + 3] = a;
                }
              }
            }

            // Store a copy of the current composite
            imageDataFrames.push(new ImageData(new Uint8ClampedArray(composite), gifWidth, gifHeight));

            prevDisposal = frame.disposalType || 0;
            prevDims = frame.dims;
          });

          gifFramesRef.current = imageDataFrames;
          frameImageDataRef.current = imageDataFrames[0];
          gifFrameIndexRef.current = 0;
          gifLastTimeRef.current = performance.now();

          updateTransformParams(gifWidth, gifHeight);
          setIsGif(true);
          setIsVideo(true); // keep render loop alive
        } catch (e) {
          setIsGif(false);
          setIsVideo(false);
        }
      };

      loadGif();
      return;
    }

    // Image
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement("canvas");
      }
      offscreenCanvasRef.current.width = img.width;
      offscreenCanvasRef.current.height = img.height;
      offscreenCtxRef.current = offscreenCanvasRef.current.getContext("2d");

      if (offscreenCtxRef.current) {
        offscreenCtxRef.current.drawImage(img, 0, 0);
        frameImageDataRef.current = offscreenCtxRef.current.getImageData(0, 0, img.width, img.height);
      }

      mediaRef.current = img;
      updateTransformParams(img.width, img.height);
      setIsVideo(false);
      setIsGif(false);
    };

    img.onerror = () => {
      mediaRef.current = null;
    };

    img.src = url;
  }, [url, _videoPlaying]);

  // Sync video playback state with control (only for actual videos, not GIFs)
  useEffect(() => {
    if (!mediaRef.current || !isVideo || isGif) return;
    const media = mediaRef.current;
    
    // Only call play/pause on actual video elements
    if (media instanceof HTMLVideoElement) {
      if (_videoPlaying) {
        media.play().catch(() => {});
      } else {
        media.pause();
      }
    }
  }, [_videoPlaying, isVideo, isGif]);

  // Note: NO mute sync - renderer video is always muted, only preview has audio

  // Sync video current time with control (seek) - only for actual videos, not GIFs
  useEffect(() => {
    if (!mediaRef.current || !isVideo || isGif) return;
    const media = mediaRef.current;
    
    // Only seek on actual video elements
    if (media instanceof HTMLVideoElement) {
      // Only seek if difference is significant (> 0.5s) to avoid constant seeking
      if (Math.abs(media.currentTime - _videoCurrentTime) > 0.5) {
        media.currentTime = _videoCurrentTime;
      }
    }
  }, [_videoCurrentTime, isVideo, isGif]);

  // Rebuild grid when dimensions or cell size change
  useMemo(() => {
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const total = cols * rows;

    const chars = new Uint32Array(total);
    const charStrings = new Array(total);
    for (let i = 0; i < total; i++) {
      const codePoint = randomChar(script);
      chars[i] = codePoint;
      charStrings[i] = String.fromCodePoint(codePoint);
    }

    gridRef.current = { cols, rows, cell: cellSize, chars, charStrings };
  }, [width, height, cellSize, script]);

  // Calculate transform parameters once (cached across sampling calls)
  const transformParamsRef = useRef<{
    scale: number;
    offsetX: number;
    offsetY: number;
    mediaWidth: number;
    mediaHeight: number;
  } | null>(null);

  const updateTransformParams = (mediaWidth?: number, mediaHeight?: number) => {
    const mW = mediaWidth ?? (mediaRef.current instanceof HTMLVideoElement ? mediaRef.current.videoWidth : mediaRef.current?.width ?? 0);
    const mH = mediaHeight ?? (mediaRef.current instanceof HTMLVideoElement ? mediaRef.current.videoHeight : mediaRef.current?.height ?? 0);
    if (!mW || !mH) return;

    // Only recalculate if dimensions changed
    const current = transformParamsRef.current;
    if (current && current.mediaWidth === mW && current.mediaHeight === mH) {
      return;
    }

    const canvasAspect = width / height;
    const mediaAspect = mW / mH;

    let scale: number;
    let offsetX: number;
    let offsetY: number;

    if (mediaAspect > canvasAspect) {
      // Media is wider - fit to height, crop sides
      scale = mH / height;
      offsetX = (mW - width * scale) / 2;
      offsetY = 0;
    } else {
      // Media is taller - fit to width, crop top/bottom
      scale = mW / width;
      offsetX = 0;
      offsetY = (mH - height * scale) / 2;
    }

    transformParamsRef.current = { scale, offsetX, offsetY, mediaWidth: mW, mediaHeight: mH };
  };

  // Sample media at given position (optimized - uses cached transform and ImageData)
  const sampleMedia = (x: number, y: number): { brightness: number; color: string } => {
    const frameData = frameImageDataRef.current;
    const transform = transformParamsRef.current;
    
    if (!frameData || !transform) {
      // No media loaded yet - return visible default
      return { brightness: 1, color: baseColor };
    }

    // Map canvas coordinates to media coordinates (using pre-calculated transform)
    const mediaX = Math.floor(x * transform.scale + transform.offsetX);
    const mediaY = Math.floor(y * transform.scale + transform.offsetY);

    // Bounds check
    if (mediaX < 0 || mediaX >= transform.mediaWidth || mediaY < 0 || mediaY >= transform.mediaHeight) {
      return { brightness: baseBrightness, color: baseColor };
    }

    // Read pixel from cached ImageData (much faster than getImageData per pixel)
    const idx = (mediaY * transform.mediaWidth + mediaX) * 4;
    const r = frameData.data[idx];
    const g = frameData.data[idx + 1];
    const b = frameData.data[idx + 2];

    // Convert to grayscale (luminance) - pre-scaled to 0-255 range
    const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);

    // Apply contrast using lookup table
    let brightness = contrastLUT[gray];

    // Invert if needed (for brightness only)
    if (invert && !keepColor) {
      brightness = 1 - brightness;
    }

    // Return color if keeping color, otherwise use baseColor with brightness
    const color = keepColor 
      ? `rgb(${r}, ${g}, ${b})` 
      : baseColor;

    return { brightness, color };
  };


  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const grid = gridRef.current;
    
    const draw = () => {
      const media = mediaRef.current;
      const offscreenCanvas = offscreenCanvasRef.current;
      const offscreenCtx = offscreenCtxRef.current;
      
      // GIF decoded playback (advance frames manually with accurate timing)
      if (isGif && gifFramesRef.current.length > 0 && gifDelaysRef.current.length > 0) {
        const now = performance.now();
        const delays = gifDelaysRef.current;
        const frames = gifFramesRef.current;
        let currentIdx = gifFrameIndexRef.current;
        let elapsed = now - gifLastTimeRef.current;

        // Advance frames while accounting for elapsed time (limit iterations to prevent lockup)
        let iterations = 0;
        const prevIdx = currentIdx;
        while (elapsed >= delays[currentIdx] && iterations < 10) {
          elapsed -= delays[currentIdx];
          currentIdx = (currentIdx + 1) % frames.length;
          iterations++;
        }

        // Only update if frame changed
        if (iterations > 0) {
          gifFrameIndexRef.current = currentIdx;
          gifLastTimeRef.current = now - elapsed; // Keep remainder for next frame
          frameImageDataRef.current = frames[currentIdx];
        }
      } else if (media && offscreenCanvas && offscreenCtx) {
        // Video or static image path
        if (isVideo) {
          offscreenCtx.drawImage(media, 0, 0);
        }
        const mediaWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
        const mediaHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
        frameImageDataRef.current = offscreenCtx.getImageData(0, 0, mediaWidth, mediaHeight);
        updateTransformParams(mediaWidth, mediaHeight);
      }

      // Clear
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw characters - optimized direct rendering (no queue, no sort)
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      // Pre-compute all brightness/color/fontSize for entire grid
      const total = grid.rows * grid.cols;
      const brightnessArray = new Float32Array(total);
      const fontSizeArray = new Uint8Array(total);
      
      // Cache for color strings
      const colorCache = colorCacheRef.current;
      const colorArray = new Array(total);
      
      // Sample entire grid once
      const cellHalf = grid.cell / 2;
      const gridCellHalf50 = grid.cell * 0.5;
      
      for (let row = 0; row < grid.rows; row++) {
        const y = row * grid.cell + cellHalf;
        for (let col = 0; col < grid.cols; col++) {
          const idx = row * grid.cols + col;
          const x = col * grid.cell + cellHalf;

          const sample = sampleMedia(x, y);
          const brightness = sample.brightness;
          brightnessArray[idx] = brightness;
          
          const fontSize = Math.max(8, gridCellHalf50 + brightness * gridCellHalf50);
          fontSizeArray[idx] = Math.round(fontSize);
          
          // Get or cache color
          if (keepColor) {
            colorArray[idx] = sample.color;
          } else {
            const brightnessKey = Math.round(brightness * 100);
            const cacheKey = `${baseColor}-${brightnessKey}`;
            let cached = colorCache.get(cacheKey);
            if (!cached) {
              cached = hexToRgba(baseColor, brightness);
              colorCache.set(cacheKey, cached);
              if (colorCache.size > 200) {
                const firstKey = colorCache.keys().next().value;
                colorCache.delete(firstKey);
              }
            }
            colorArray[idx] = cached;
          }
        }
      }

      // Render directly in grid order (minimize state changes by tracking)
      let currentFontSize = -1;
      let currentColor = '';
      
      for (let row = 0; row < grid.rows; row++) {
        const y = row * grid.cell + cellHalf;
        for (let col = 0; col < grid.cols; col++) {
          const idx = row * grid.cols + col;
          const x = col * grid.cell + cellHalf;
          
          const fontSize = fontSizeArray[idx];
          const color = colorArray[idx];
          
          if (fontSize !== currentFontSize) {
            ctx.font = `${fontSize}px monospace`;
            currentFontSize = fontSize;
          }
          if (color !== currentColor) {
            ctx.fillStyle = color;
            currentColor = color;
          }
          
          ctx.fillText(grid.charStrings[idx], x, y);
        }
      }

      // Only continue animation if not paused and if we have video/gif media
      if (!isPaused && (isVideo || isGif)) {
        animationRef.current = requestAnimationFrame(draw);
      } else if (!isPaused && !isVideo && !isGif) {
        // For static images, just draw once
        // No need to requestAnimationFrame again
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [width, height, isPaused, baseColor, baseBrightness, contrast, invert, keepColor, url, isVideo, isGif, cellSize, script]);

  // Video export functions
  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const stream = canvas.captureStream(30); // 30 fps
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000, // 5 Mbps
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `automa-export-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      const startTime = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      alert('Failed to start recording. Your browser may not support this feature.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", width: "100%", flex: 1 }}
      />
      <div style={{ 
        padding: "12px", 
        background: "#111", 
        borderTop: "1px solid #333",
        display: "flex",
        alignItems: "center",
        gap: "12px"
      }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{
              padding: "8px 16px",
              background: "#e11d48",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "14px",
            }}
          >
            ● Start Recording
          </button>
        ) : (
          <>
            <button
              onClick={stopRecording}
              style={{
                padding: "8px 16px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "14px",
              }}
            >
              ■ Stop & Download
            </button>
            <span style={{ color: "#e11d48", fontWeight: 500, fontSize: "14px" }}>
              Recording: {formatTime(recordingTime)}
            </span>
          </>
        )}
        <span style={{ color: "#666", fontSize: "12px", marginLeft: "auto" }}>
          WebM format, 30fps
        </span>
      </div>
    </div>
  );
}
