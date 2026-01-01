import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Parameter } from "@/types/automa";
import { useRef, useState, useEffect } from "react";

interface ControlMediaProps {
  parameter: Parameter;
  value: string;
  onChange: (value: string) => void;
}

export function ControlMedia({ parameter, value, onChange }: ControlMediaProps) {
  const { label, placeholder = "Enter image/video URL or upload file" } = parameter;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file is an image or video
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please select an image or video file');
      return;
    }

    // Detect media type
    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    }

    // Convert to data URI
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      onChange(dataUri);
    };
    reader.onerror = () => {
      alert('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  // Detect media type from URL
  const detectMediaType = (url: string) => {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/i) || url.startsWith('data:image/')) {
      return 'image';
    } else if (lower.match(/\.(mp4|webm|ogg|mov)(\?|#|$)/i) || url.startsWith('data:video/')) {
      return 'video';
    }
    return null;
  };

  const currentMediaType = mediaType || detectMediaType(value);

  // Validate media URL
  useEffect(() => {
    if (!value) {
      setValidationState('idle');
      setErrorMessage('');
      return;
    }

    // Debounce validation
    const timeoutId = setTimeout(() => {
      setValidationState('validating');
      setErrorMessage('');

      const testMediaType = detectMediaType(value);
      
      if (testMediaType === 'video' || value.startsWith('data:video/')) {
        // Test video loading AND canvas access
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous'; // Required for canvas access
        video.src = value;
        
        const loadTimeout = setTimeout(() => {
          setValidationState('error');
          setErrorMessage('Failed to load media.');
        }, 10000); // 10 second timeout

        video.onloadedmetadata = () => {
          clearTimeout(loadTimeout);
          
          // Test canvas access to detect CORS issues
          try {
            const testCanvas = document.createElement('canvas');
            testCanvas.width = 1;
            testCanvas.height = 1;
            const testCtx = testCanvas.getContext('2d');
            if (testCtx) {
              testCtx.drawImage(video, 0, 0, 1, 1);
              testCtx.getImageData(0, 0, 1, 1); // This will throw if CORS blocked
            }
            setValidationState('valid');
            setErrorMessage('');
          } catch (e) {
            setValidationState('error');
            setErrorMessage('Failed to load media.');
          }
        };

        video.onerror = () => {
          clearTimeout(loadTimeout);
          setValidationState('error');
          setErrorMessage('Failed to load media.');
        };
      } else {
        // Test image loading AND canvas access (includes GIFs)
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Required for canvas access
        
        const loadTimeout = setTimeout(() => {
          setValidationState('error');
          setErrorMessage('Failed to load media.');
        }, 10000); // 10 second timeout

        img.onload = () => {
          clearTimeout(loadTimeout);
          
          // Test canvas access to detect CORS issues
          try {
            const testCanvas = document.createElement('canvas');
            testCanvas.width = 1;
            testCanvas.height = 1;
            const testCtx = testCanvas.getContext('2d');
            if (testCtx) {
              testCtx.drawImage(img, 0, 0, 1, 1);
              testCtx.getImageData(0, 0, 1, 1); // This will throw if CORS blocked
            }
            setValidationState('valid');
            setErrorMessage('');
          } catch (e) {
            setValidationState('error');
            setErrorMessage('Failed to load media.');
          }
        };

        img.onerror = () => {
          clearTimeout(loadTimeout);
          setValidationState('error');
          setErrorMessage('Failed to load media.');
        };

        img.src = value;
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={parameter.key} className="text-sm font-medium">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Upload file"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 10V3M7 3L4 6M7 3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setMediaType(null);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Clear"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* URL input */}
      <div className="space-y-1">
        <div className="relative">
          <Input
            id={parameter.key}
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              setMediaType(null); // Reset to auto-detect
            }}
            className={`h-9 font-mono text-xs ${value && validationState === 'validating' ? 'pr-8' : 'pr-2'} ${
              validationState === 'error' ? 'border-red-500 focus-visible:ring-red-500' : ''
            }`}
          />
          {/* Validation indicator - only spinner */}
          {value && validationState === 'validating' && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        
        {/* Error message - only show on error */}
        {validationState === 'error' && errorMessage && (
          <p className="text-xs text-red-500 flex items-start gap-1">
            <span className="inline-block mt-0.5">⚠</span>
            <span>{errorMessage}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// Keep old name as alias for backward compatibility
export const ControlImage = ControlMedia;
