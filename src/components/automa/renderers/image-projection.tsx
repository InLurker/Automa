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

// Build fixed character pool from text array
function buildFixedPool(textArray: string[] | string): Uint32Array {
  // Handle both array and legacy string format
  let texts: string[];
  if (Array.isArray(textArray)) {
    texts = textArray.map(t => t.trim()).filter(t => t.length > 0);
  } else {
    const cleaned = (textArray && textArray.trim()) || "AUTOMA";
    texts = cleaned.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
  
  if (!texts.length) return new Uint32Array([65]); // 'A'
  
  const result: number[] = [];
  
  for (const text of texts) {
    const chars = Array.from(text);
    for (const char of chars) {
      result.push(char.codePointAt(0) || 63);
    }
  }
  
  return new Uint32Array(result);
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

export function ImageProjectionAutoma(props: AutomaComponentProps) {
  const { values, width, height, isPaused, onChange } = props;
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");

  // Extract values FIRST (support both old imageUrl and new mediaUrl)
  const {
    cellSize = 16,
    script = "alphabet",
    fillMode = "random",
    fixedText = ["AUTOMA"],
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
  
  // Refs for values that can change without restarting render loop
  const keepColorRef = useRef(keepColor);
  
  // Update refs when values change
  useEffect(() => {
    keepColorRef.current = keepColor;
  }, [keepColor]);
  
  // Clear color cache when baseColor or keepColor changes
  // Also limit RGB cache size periodically to prevent unbounded growth
  useEffect(() => {
    colorCacheRef.current.clear();
    
    // For keepColor mode (RGB caching), set up periodic cleanup
    if (keepColor) {
      const cleanupInterval = setInterval(() => {
        // If cache gets too large (> 2000 entries), clear it
        // This prevents memory issues with high-color-variety videos
        if (colorCacheRef.current.size > 2000) {
          colorCacheRef.current.clear();
        }
      }, 5000); // Check every 5 seconds
      
      return () => clearInterval(cleanupInterval);
    }
  }, [baseColor, keepColor]);

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
  
  // Track grid version to trigger re-render when grid changes
  const [gridVersion, setGridVersion] = useState(0);

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
        video.currentTime = 0; // Reset to start when importing new media

        setIsVideo(true);
        setIsGif(false);
        updateTransformParams(video.videoWidth, video.videoHeight);
        
        // Reset time but don't force pause state - let it be controlled by user
        if (props.onChange) {
          props.onChange({ ...values, _videoCurrentTime: 0 });
        }
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
  }, [url]);

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
    
    // Build character pool based on fillMode
    if (fillMode === "fixed") {
      const fixedPool = buildFixedPool(fixedText);
      const fixedLen = fixedPool.length;
      for (let i = 0; i < total; i++) {
        const codePoint = fixedPool[i % fixedLen];
        chars[i] = codePoint;
        charStrings[i] = String.fromCodePoint(codePoint);
      }
    } else {
      // Random mode
      for (let i = 0; i < total; i++) {
        const codePoint = randomChar(script);
        chars[i] = codePoint;
        charStrings[i] = String.fromCodePoint(codePoint);
      }
    }

    gridRef.current = { cols, rows, cell: cellSize, chars, charStrings };
    
    // Increment grid version to trigger re-render
    setGridVersion(v => v + 1);
  }, [width, height, cellSize, script, fillMode, fixedText]);

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
      // No media loaded yet - use base brightness
      return { brightness: baseBrightness, color: baseColor };
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

    // When media is loaded, use 0 base brightness (follow image color only)
    // brightness stays as calculated from the image

    // Only cache RGB colors when keepColor is enabled (dynamic color mode)
    // In static color mode, we only need brightness, so skip expensive color caching
    let color = baseColor;
    if (keepColorRef.current) {
      // Cache RGB color strings to avoid repeated string creation
      // Use simple concatenation instead of template literal for better performance
      const colorKey = `${r},${g},${b}`;
      let cached = colorCacheRef.current.get(colorKey);
      if (!cached) {
        cached = `rgb(${r},${g},${b})`;
        colorCacheRef.current.set(colorKey, cached);
      }
      color = cached;
    }

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
        // Only advance frames if not paused
        if (!isPaused) {
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
        }
        // When paused, frameImageDataRef.current already has the last frame - just render it
      } else if (media && offscreenCanvas && offscreenCtx) {
        // Video or static image path
        if (isVideo && media instanceof HTMLVideoElement) {
          // Always draw current video frame (works for both playing and paused)
          offscreenCtx.drawImage(media, 0, 0);
          frameImageDataRef.current = offscreenCtx.getImageData(0, 0, media.videoWidth, media.videoHeight);
          updateTransformParams(media.videoWidth, media.videoHeight);
        } else if (!isVideo) {
          // Static image
          const mediaWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
          const mediaHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
          frameImageDataRef.current = offscreenCtx.getImageData(0, 0, mediaWidth, mediaHeight);
          updateTransformParams(mediaWidth, mediaHeight);
        }
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
      
      const useKeepColor = keepColorRef.current;
      
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
          if (useKeepColor) {
            // Use the pre-cached RGB color from sample
            colorArray[idx] = sample.color;
          } else {
            // Generate baseColor with brightness
            // Static color mode: only ~100 unique brightness values, cache is small
            const brightnessKey = Math.round(brightness * 100);
            const cacheKey = `base-${baseColor}-${brightnessKey}`;
            let cached = colorCache.get(cacheKey);
            if (!cached) {
              cached = hexToRgba(baseColor, brightness);
              colorCache.set(cacheKey, cached);
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

      // Continue animation if not paused and we have video/gif media
      if (!isPaused && (isVideo || isGif)) {
        animationRef.current = requestAnimationFrame(draw);
      } else if (isPaused && (isVideo || isGif)) {
        // When paused, keep drawing the current frame to maintain visibility
        // This ensures the canvas shows the last frame instead of going dark
        animationRef.current = requestAnimationFrame(draw);
      }
      // For static images, draw once and stop
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [width, height, isPaused, baseColor, baseBrightness, contrast, invert, url, isVideo, isGif, cellSize, gridVersion]);


  // Export function - renders to MP4 with audio
  const startExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if we have media to export
    if (!mediaRef.current) {
      alert('Please load media before exporting.');
      return;
    }

    let audioVideo: HTMLVideoElement | null = null; // Declare here for cleanup in catch
    const wasPlaying = _videoPlaying; // Store original playing state
    const wasAnimating = animationRef.current !== null; // Store if animation was running

    try {
      setIsExporting(true);
      setExportProgress(0);
      setExportStatus("Preparing...");

      // Pause main canvas animation during export
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Pause preview video
      if (isVideo) {
        props.onChange?.({ ...values, _videoPlaying: false });
      }

      const media = mediaRef.current;
      let exportWidth = width;
      let exportHeight = height;
      let duration = 5; // Default 5 seconds for static images
      let fps = 30;

      // For video/gif, use canvas height and original aspect ratio
      if (isVideo && media instanceof HTMLVideoElement) {
        // Use canvas height, maintain original aspect ratio
        const aspectRatio = media.videoWidth / media.videoHeight;
        
        // Calculate dimensions that are evenly divisible by cellSize
        const targetHeight = height;
        const targetWidth = targetHeight * aspectRatio;
        
        // Round to nearest multiple of cellSize
        // Use Math.round instead of floor to minimize aspect ratio distortion
        exportHeight = Math.round(targetHeight / cellSize) * cellSize;
        exportWidth = Math.round(targetWidth / cellSize) * cellSize;
        
        duration = media.duration;
        
        // For videos, try to match original framerate (default to 30fps for web videos)
        // Most web videos are 24, 30, or 60 fps
        fps = 30; // HTMLVideoElement doesn't expose framerate, use standard 30fps
        
        // Pause video completely during export
        media.pause();
        const wasPaused = media.paused;
        if (!wasPaused) {
          // Force pause if it didn't take
          media.pause();
        }
      } else if (isGif && gifFramesRef.current.length > 0) {
        // Use canvas height, maintain original GIF aspect ratio
        const originalWidth = gifSizeRef.current?.width || offscreenCanvasRef.current?.width || width;
        const originalHeight = gifSizeRef.current?.height || offscreenCanvasRef.current?.height || height;
        const aspectRatio = originalWidth / originalHeight;
        
        // Calculate dimensions that are evenly divisible by cellSize
        const targetHeight = height;
        const targetWidth = targetHeight * aspectRatio;
        
        // Round to nearest multiple of cellSize
        // Use Math.round instead of floor to minimize aspect ratio distortion
        exportHeight = Math.round(targetHeight / cellSize) * cellSize;
        exportWidth = Math.round(targetWidth / cellSize) * cellSize;
        
        // Calculate duration from frame delays
        const totalDelay = gifDelaysRef.current.reduce((sum, d) => sum + d, 0);
        duration = totalDelay / 1000; // Convert ms to seconds
        
        // Use actual frame count and duration for accurate FPS
        fps = Math.round(gifFramesRef.current.length / duration);
        // Clamp to reasonable range
        fps = Math.max(10, Math.min(60, fps));
      }

      // Create export canvas with media dimensions
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) throw new Error('Failed to create export canvas context');

      setExportStatus("Initializing recorder...");

      // Capture canvas stream
      const canvasStream = exportCanvas.captureStream(fps);
      
      // If video with audio, create separate video element for audio playback
      let finalStream = canvasStream;
      
      if (isVideo && media instanceof HTMLVideoElement) {
        try {
          // Create a clone video element for continuous audio playback
          audioVideo = document.createElement('video');
          audioVideo.src = media.src || media.currentSrc;
          audioVideo.muted = false;
          audioVideo.volume = 1.0;
          audioVideo.currentTime = 0;
          
          // Wait for it to load
          await new Promise((resolve) => {
            audioVideo!.onloadedmetadata = resolve;
          });
          
          // Start playing audio video
          await audioVideo.play();
          
          // Capture audio stream from the playing video
          const audioVideoStream = (audioVideo as any).captureStream ? (audioVideo as any).captureStream() : (audioVideo as any).mozCaptureStream();
          const audioTracks = audioVideoStream.getAudioTracks();
          
          if (audioTracks.length > 0) {
            // Combine video from canvas with audio from separate playing video
            finalStream = new MediaStream([
              ...canvasStream.getVideoTracks(),
              ...audioTracks
            ]);
            console.log('[Export] Audio track added successfully');
          }
        } catch (err) {
          console.warn('[Export] Could not capture audio:', err);
        }
      }

      // Setup MediaRecorder with proper audio+video codecs
      let mimeType = 'video/webm';
      let options: MediaRecorderOptions = { videoBitsPerSecond: 5000000 };
      
      // Check if we have audio
      const hasAudio = finalStream.getAudioTracks().length > 0;

      // Try different codec combinations (prioritize quality)
      const codecsToTry = hasAudio ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=h265,opus', // H.265/HEVC - likely unsupported but worth trying
        'video/mp4;codecs=avc1,opus', // H.264 in MP4
        'video/webm', // Generic WebM with audio
        'video/mp4', // Generic MP4
      ] : [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264',
        'video/mp4;codecs=h265', // H.265/HEVC
        'video/mp4;codecs=avc1', // H.264
        'video/webm',
        'video/mp4',
      ];

      let codecFound = false;
      for (const codec of codecsToTry) {
        if (MediaRecorder.isTypeSupported(codec)) {
          mimeType = codec;
          options.mimeType = codec;
          codecFound = true;
          console.log(`[Export] Using codec: ${codec}`);
          break;
        }
      }

      if (!codecFound) {
        console.warn('[Export] No specific codec supported, using browser default');
        // Don't specify mimeType, let browser choose
        delete options.mimeType;
      }

      const mediaRecorder = new MediaRecorder(finalStream, options);

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Clean up audio video if it exists
        if (audioVideo) {
          audioVideo.pause();
          audioVideo.src = '';
          audioVideo = null;
        }
        
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `automa-export-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);

        setExportProgress(100);
        setExportStatus("Complete!");
        
        setTimeout(() => {
          setIsExporting(false);
          setExportProgress(0);
          setExportStatus("");
          
          // Restore playing state
          if (isVideo && wasPlaying) {
            props.onChange?.({ ...values, _videoPlaying: true });
          }
          
          // Restart main canvas animation if it was running
          if (wasAnimating && (isVideo || isGif)) {
            // Trigger re-render by updating a dependency (use a small delay to ensure state is settled)
            setTimeout(() => {
              if (canvasRef.current) {
                // Force re-render by touching the canvas
                canvasRef.current.style.opacity = '0.9999';
                requestAnimationFrame(() => {
                  if (canvasRef.current) {
                    canvasRef.current.style.opacity = '1';
                  }
                });
              }
            }, 100);
          }
        }, 1500);
      };

      mediaRecorder.start();
      setExportStatus("Recording...");

      // Render frames
      const totalFrames = Math.ceil(duration * fps);
      const frameDuration = 1000 / fps;
      
      // Create local color cache for export
      const exportColorCache = new Map<string, string>();
      
      // Pre-generate character grid ONCE (not per frame!)
      const exportCols = Math.floor(exportWidth / cellSize);
      const exportRows = Math.floor(exportHeight / cellSize);
      const exportTotal = exportCols * exportRows;
      
      // Build character pool based on fillMode - ONCE before the loop
      let exportCharStrings: string[];
      if (fillMode === "fixed") {
        const fixedPool = buildFixedPool(fixedText);
        const fixedLen = fixedPool.length;
        exportCharStrings = Array.from({ length: exportTotal }, (_, i) => 
          String.fromCodePoint(fixedPool[i % fixedLen])
        );
      } else {
        exportCharStrings = Array.from({ length: exportTotal }, () => 
          String.fromCodePoint(randomChar(script))
        );
      }
      
      const exportGrid = {
        cols: exportCols,
        rows: exportRows,
        cell: cellSize,
        charStrings: exportCharStrings,
      };
      
      // Create separate offscreen canvas for export rendering
      const exportOffscreenCanvas = document.createElement('canvas');
      const exportOffscreenCtx = exportOffscreenCanvas.getContext('2d');
      if (!exportOffscreenCtx) throw new Error('Failed to create export offscreen context');
      
      for (let i = 0; i < totalFrames; i++) {
        const currentTime = i / fps;
        
        // Get frame data for export (without modifying main canvas refs)
        let exportFrameData: ImageData | null = null;
        
        if (isVideo && media instanceof HTMLVideoElement) {
          media.currentTime = currentTime;
          await new Promise(resolve => {
            media.onseeked = () => resolve(null);
          });
          
          // Render to separate offscreen canvas
          if (!exportOffscreenCanvas.width) {
            exportOffscreenCanvas.width = media.videoWidth;
            exportOffscreenCanvas.height = media.videoHeight;
          }
          exportOffscreenCtx.drawImage(media, 0, 0);
          exportFrameData = exportOffscreenCtx.getImageData(0, 0, media.videoWidth, media.videoHeight);
        } else if (isGif && gifFramesRef.current.length > 0) {
          const frameIdx = Math.floor((currentTime / duration) * gifFramesRef.current.length) % gifFramesRef.current.length;
          exportFrameData = gifFramesRef.current[frameIdx];
        } else {
          // Static image - use current frameImageDataRef
          exportFrameData = frameImageDataRef.current;
        }

        // Clear export canvas
        exportCtx.fillStyle = "#000000";
        exportCtx.fillRect(0, 0, exportWidth, exportHeight);
        exportCtx.textBaseline = "middle";
        exportCtx.textAlign = "center";

        // Calculate transform for export canvas (media -> export canvas mapping)
        if (!exportFrameData) continue; // Skip if no frame data
        
        const mediaWidth = exportFrameData.width;
        const mediaHeight = exportFrameData.height;
        // Use Math.max (cover) instead of Math.min (contain) to fill canvas without gaps
        const exportScale = Math.max(exportWidth / mediaWidth, exportHeight / mediaHeight);
        const scaledMediaWidth = mediaWidth * exportScale;
        const scaledMediaHeight = mediaHeight * exportScale;
        const exportOffsetX = (exportWidth - scaledMediaWidth) / 2;
        const exportOffsetY = (exportHeight - scaledMediaHeight) / 2;
        
        // Render to export canvas
        const cellHalf = exportGrid.cell / 2;
        const gridCellHalf50 = exportGrid.cell * 0.5;
        
        for (let row = 0; row < exportGrid.rows; row++) {
          const y = row * exportGrid.cell + cellHalf;
          for (let col = 0; col < exportGrid.cols; col++) {
            const x = col * exportGrid.cell + cellHalf;
            const idx = row * exportGrid.cols + col;
            
            // Map export canvas coords to media coords
            const mediaX = Math.floor((x - exportOffsetX) / exportScale);
            const mediaY = Math.floor((y - exportOffsetY) / exportScale);
            
            let brightness = baseBrightness;
            let color = baseColor;
            
            // Sample pixel from frame data
            if (mediaX >= 0 && mediaX < mediaWidth && mediaY >= 0 && mediaY < mediaHeight) {
              const pixelIdx = (mediaY * mediaWidth + mediaX) * 4;
              const r = exportFrameData.data[pixelIdx];
              const g = exportFrameData.data[pixelIdx + 1];
              const b = exportFrameData.data[pixelIdx + 2];
              
              // Calculate brightness (luminance)
              const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
              brightness = contrastLUT[gray];
              
              // Invert if needed
              if (invert) {
                brightness = 1 - brightness;
              }
              
              // Keep color if enabled
              if (keepColor) {
                const colorKey = `${r},${g},${b}`;
                let cachedColor = exportColorCache.get(colorKey);
                if (!cachedColor) {
                  cachedColor = `rgba(${r},${g},${b},${brightness})`;
                  exportColorCache.set(colorKey, cachedColor);
                }
                color = cachedColor;
              } else {
                color = hexToRgba(baseColor, brightness);
              }
            }
            
            const fontSize = Math.max(8, gridCellHalf50 + brightness * gridCellHalf50);
            
            exportCtx.font = `${Math.round(fontSize)}px monospace`;
            exportCtx.fillStyle = color;
            exportCtx.fillText(exportGrid.charStrings[idx], x, y);
          }
        }

        // Use minimal delay to allow canvas stream to capture frame
        // The captureStream(fps) handles frame rate timing
        await new Promise(resolve => setTimeout(resolve, 1));
        
        setExportProgress(Math.floor(((i + 1) / totalFrames) * 100));
      }

      // Stop recording
      mediaRecorder.stop();
      setExportStatus("Finalizing...");

    } catch (err) {
      // Clean up audio video if it exists
      if (audioVideo) {
        audioVideo.pause();
        audioVideo.src = '';
        audioVideo = null;
      }
      
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus("");
      
      // Restore playing state
      if (isVideo && wasPlaying) {
        props.onChange?.({ ...values, _videoPlaying: true });
      }
      
      // Restart main canvas animation if it was running
      if (wasAnimating && (isVideo || isGif)) {
        setTimeout(() => {
          if (canvasRef.current) {
            canvasRef.current.style.opacity = '0.9999';
            requestAnimationFrame(() => {
              if (canvasRef.current) {
                canvasRef.current.style.opacity = '1';
              }
            });
          }
        }, 100);
      }
      
      alert(`Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", maxWidth: "100%", maxHeight: "100%" }}
      />
      
      {/* Floating export button */}
      <div style={{
        position: "absolute",
        bottom: "24px",
        right: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        alignItems: "flex-end",
        zIndex: 10,
      }}>
        {isExporting && (
          <div style={{
            padding: "12px 16px",
            background: "rgba(0, 0, 0, 0.9)",
            backdropFilter: "blur(10px)",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            minWidth: "200px",
          }}>
            <div style={{ color: "white", fontWeight: 500, fontSize: "13px", marginBottom: "8px" }}>
              {exportStatus}
            </div>
            <div style={{ 
              width: "100%", 
              height: "4px", 
              background: "rgba(255, 255, 255, 0.1)", 
              borderRadius: "2px",
              overflow: "hidden"
            }}>
            <div style={{ 
              width: `${exportProgress}%`, 
              height: "100%", 
              background: "white",
              transition: "width 0.3s ease"
            }} />
            </div>
            <div style={{ color: "#888", fontSize: "11px", marginTop: "4px", textAlign: "right" }}>
              {exportProgress}%
            </div>
          </div>
        )}
        
        <button
          onClick={startExport}
          disabled={isExporting}
          style={{
            padding: "10px 16px",
            background: isExporting ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
            color: isExporting ? "#666" : "white",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "8px",
            cursor: isExporting ? "not-allowed" : "pointer",
            fontWeight: 500,
            fontSize: "14px",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: isExporting ? "none" : "0 0 16px rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.4)",
          }}
          onMouseEnter={(e) => {
            if (!isExporting) {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.9)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(255, 255, 255, 0.4), 0 4px 16px rgba(0, 0, 0, 0.5)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isExporting) {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.8)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              e.currentTarget.style.boxShadow = "0 0 16px rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.4)";
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M3 2h8l2 2v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M9 2v3H4V2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <rect x="5" y="9" width="6" height="4" fill="currentColor"/>
          </svg>
          {isExporting ? "Exporting..." : "Export"}
        </button>
      </div>
    </div>
  );
}
