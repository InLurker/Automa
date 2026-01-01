# Image Projection Automa - Technical Documentation

## Overview

The **Image Projection** automa converts images, videos, and GIFs into animated text art by mapping pixel brightness to character size and opacity. This creates a dynamic ASCII-art-like effect that plays in real-time.

---

## How It Works

### 1. Grid System

The canvas is divided into a uniform grid of cells:

```
┌─────┬─────┬─────┬─────┐
│  字  │  你  │  好  │  世  │  ← Each cell = cellSize pixels (default: 16px)
├─────┼─────┼─────┼─────┤
│  界  │  中  │  国  │  人  │  ← One random character per cell
└─────┴─────┴─────┴─────┘
```

**Grid Calculation:**
```typescript
cols = ceil(canvasWidth / cellSize)
rows = ceil(canvasHeight / cellSize)
totalCells = cols × rows
```

### 2. Character Assignment

Each grid cell is assigned a random character from the selected script (Alphabet, Chinese, Japanese, or Korean):

```typescript
for (let i = 0; i < totalCells; i++) {
  chars[i] = randomChar(script);
}
```

### 3. Media Sampling & Processing

#### A. Object-Fit: Cover Algorithm

The media (image/video/GIF) is scaled and cropped to fill the canvas while maintaining aspect ratio:

```typescript
const canvasAspect = width / height;
const mediaAspect = mediaWidth / mediaHeight;

if (mediaAspect > canvasAspect) {
  // Media is wider - fit to height, crop sides
  scale = mediaHeight / height;
  offsetX = (mediaWidth - width × scale) / 2;
  offsetY = 0;
} else {
  // Media is taller - fit to width, crop top/bottom
  scale = mediaWidth / width;
  offsetX = 0;
  offsetY = (mediaHeight - height × scale) / 2;
}
```

#### B. Pixel Sampling

For each character cell at position `(x, y)`:

1. **Map canvas coordinates to media coordinates:**
   ```typescript
   mediaX = floor(x × scale + offsetX)
   mediaY = floor(y × scale + offsetY)
   ```

2. **Read pixel color from cached ImageData:**
   ```typescript
   const idx = (mediaY × mediaWidth + mediaX) × 4;
   const r = frameData.data[idx];
   const g = frameData.data[idx + 1];
   const b = frameData.data[idx + 2];
   ```

#### C. Brightness Calculation

Convert RGB to perceived brightness using luminance formula:

```typescript
brightness = (0.299 × R + 0.587 × G + 0.114 × B) / 255
```

This formula weights:
- **Red**: 29.9% (human eyes less sensitive)
- **Green**: 58.7% (human eyes most sensitive)
- **Blue**: 11.4% (human eyes least sensitive)

**Result**: Value from `0.0` (black) to `1.0` (white)

#### D. Contrast Adjustment

Apply gamma correction to enhance contrast:

```typescript
brightness = brightness ^ (1 / contrast)
```

- `contrast = 1.0` → No change
- `contrast > 1.0` → More contrast (darker darks, brighter brights)
- `contrast < 1.0` → Less contrast (flatter image)

#### E. Invert (Optional)

If invert is enabled in monochrome mode:

```typescript
if (invert && !keepColor) {
  brightness = 1.0 - brightness;
}
```

### 4. Character Rendering

#### A. Font Size Calculation

Map brightness to character size:

```typescript
fontSize = max(8px, cellSize × (0.5 + brightness × 0.5))
```

**Examples** (cellSize = 16px):
| Brightness | Calculation | fontSize |
|-----------|-------------|----------|
| 0.0 (black) | 16 × 0.5 | 8px |
| 0.5 (gray) | 16 × 0.75 | 12px |
| 1.0 (white) | 16 × 1.0 | 16px |

**Why this formula?**
- Minimum 50% of cell size ensures characters are visible
- Maximum 100% of cell size prevents overflow
- Linear mapping creates smooth transitions

#### B. Color & Opacity

**Monochrome Mode (keepColor = false):**
```typescript
color = rgba(baseColor, brightness)
```
- Dark areas: Low alpha (transparent)
- Bright areas: High alpha (opaque)

**Color Mode (keepColor = true):**
```typescript
color = rgb(r, g, b)  // Original pixel color, full opacity
```

### 5. Optimization Strategies

#### Single Frame Capture
Instead of calling `getImageData()` for every character (~8,100 calls for 1080p):

```typescript
// ❌ BAD: 8,100+ calls per frame
for each character {
  const pixel = ctx.getImageData(x, y, 1, 1);
}

// ✅ GOOD: 1 call per frame
const allPixels = ctx.getImageData(0, 0, width, height);
for each character {
  const pixel = allPixels.data[index];
}
```

**Impact**: ~99% reduction in expensive WebGL calls

#### Cached Transform Parameters
Pre-calculate aspect ratios and scaling once per frame:

```typescript
// Calculated once
const transform = {
  scale, offsetX, offsetY, 
  mediaWidth, mediaHeight
};

// Reused for all 8,100+ characters
```

#### Batched Font Changes
Sort characters by font size to minimize `ctx.font` calls:

```typescript
// ❌ BAD: 8,100 font changes
for each character {
  ctx.font = `${fontSize}px monospace`;
  ctx.fillText(char, x, y);
}

// ✅ GOOD: ~10-20 font changes
renderQueue.sort((a, b) => a.fontSize - b.fontSize);
let currentFont = -1;
for each character {
  if (fontSize !== currentFont) {
    ctx.font = `${fontSize}px monospace`;
  }
  ctx.fillText(char, x, y);
}
```

---

## Media Type Handling

### Static Images (JPG, PNG, etc.)
- Loaded once via `Image()` element
- Drawn to offscreen canvas once
- Cached for sampling

### Animated GIFs
- Loaded via `Image()` element (animates natively)
- Redrawn to offscreen canvas every frame
- Treated like video for continuous rendering

### Videos (MP4, WebM, etc.)
- Loaded via `HTMLVideoElement`
- Two instances:
  - **Renderer video**: Hidden, always muted, samples frames
  - **Preview video**: Visible in sidebar, has audio, syncs with renderer
- Current frame drawn to offscreen canvas every frame

---

## Performance Characteristics

### Frame Processing Pipeline
1. **Capture frame** (~1-2ms): Draw media to offscreen canvas
2. **Get ImageData** (~1-2ms): Read entire frame pixel data
3. **Sample pixels** (~1-3ms): Direct array access for all characters
4. **Render characters** (~3-5ms): Canvas 2D text rendering

**Total**: ~8-12ms per frame (**~100 FPS capable**)

### Memory Usage
- **ImageData buffer**: `width × height × 4 bytes`
  - 1920×1080: ~8.3 MB per frame
- **Character array**: `(cols × rows) × 4 bytes` (32-bit Unicode)
  - 1920×1080 @ 16px cells: ~30 KB

---

## Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cellSize` | slider | 16px | Size of each character cell (8-32px) |
| `script` | select | chinese | Character set: alphabet, chinese, japanese, korean |
| `baseColor` | color | #ffffff | Text color (monochrome mode) |
| `baseBrightness` | slider | 0.3 | Minimum brightness when no media loaded |
| `contrast` | slider | 1.5 | Contrast adjustment (0.5-3.0) |
| `invert` | toggle | false | Invert brightness (negative effect) |
| `keepColor` | toggle | false | Use original colors vs monochrome |

---

## Examples

### High Contrast Portrait
```
Settings:
- cellSize: 12px (more detail)
- contrast: 2.0 (dramatic shadows)
- invert: false
- keepColor: false

Result: Clear facial features with deep shadows
```

### Colorful Animation
```
Settings:
- cellSize: 16px
- keepColor: true
- contrast: 1.2

Result: Vibrant, pointillism-like mosaic
```

### Minimalist Sketch
```
Settings:
- cellSize: 20px (larger, fewer characters)
- contrast: 1.0
- invert: true
- baseColor: #000000 (black on white)

Result: Sketch/line-art effect
```

---

## Technical Stack

- **Rendering**: Canvas 2D API
- **Media Loading**: HTMLImageElement, HTMLVideoElement
- **Frame Sampling**: OffscreenCanvas + ImageData
- **State Management**: React hooks (useRef, useState, useEffect)
- **Synchronization**: Shared state for video controls

---

## Known Limitations

1. **Large videos**: High resolution videos (4K+) may impact performance
2. **Text rendering**: Very small cell sizes (<8px) may have readability issues
3. **Browser support**: Requires modern browser with Canvas 2D API
4. **CORS**: External images/videos must have CORS headers enabled

---

## Future Enhancements

- [ ] WebGL-based renderer for higher performance
- [ ] Adjustable character refresh rate
- [ ] Custom character sets (user-defined)
- [ ] Color palette mapping
- [ ] Export as video/GIF
- [ ] Real-time webcam input
