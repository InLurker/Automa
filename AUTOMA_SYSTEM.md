# Automa System Documentation

This document describes the automa system architecture and how to add new automa.

## Overview

Automa is a minimalist zen playground for interactive animations built on the Astro Nomy template. The system provides:

- **Schema-driven controls**: Define parameters once, get UI automatically
- **Reusable components**: Shared control library across all automa
- **Iframe isolation**: Each automa runs independently with postMessage communication
- **Theme organization**: Automa grouped into Flow, Structure, and Rhythm themes

## Architecture

### Core Components

1. **Registry** (`src/config/automa-registry.ts`)
   - Single source of truth for all automa
   - Defines metadata, schema, defaults, and renderer info

2. **Type System** (`src/types/automa.ts`)
   - TypeScript definitions for automa, parameters, and messages
   - Ensures type safety across the system

3. **Control Components** (`src/components/automa/`)
   - `control-slider.tsx` - Slider with live value display
   - `control-number.tsx` - Number input with unit support
   - `control-toggle.tsx` - Boolean toggle switch
   - `control-select.tsx` - Dropdown selection
   - `control-text.tsx` - Text input
   - `control-color.tsx` - Color picker
   - `control-section.tsx` - Collapsible parameter groups
   - `controls-panel.tsx` - Main panel that renders all controls

4. **Layout Components**
   - `automa-layout.tsx` - Top bar + controls + viewport layout
   - `automa-viewer.tsx` - Iframe wrapper with postMessage handling

5. **Pages**
   - `/explore` - Discovery page with themed tiles
   - `/automa/[slug]` - Individual automa viewer

## Parameter Schema

Each automa defines a schema describing its configurable parameters:

```typescript
{
  key: "speed",           // Unique identifier
  label: "Speed",         // Display name
  type: "slider",         // Control type
  group: "Motion",        // Section grouping
  live: true,             // Update without rebuild?
  min: 0.1,              // Min value (for numbers)
  max: 5,                // Max value (for numbers)
  step: 0.1,             // Increment step
  unit: "px"             // Display unit (optional)
}
```

### Parameter Types

- `slider` - Range slider with live value display
- `number` - Number input field
- `select` - Dropdown with options
- `toggle` - Boolean on/off switch
- `text` - Text input
- `color` - Color picker

### Parameter Groups

Standard groups used across automa:

- **Motion** - speed, direction, noise, drift
- **Geometry** - spacing, count, size, resolution
- **Appearance** - intensity, contrast, thickness, color
- **Timing** - rate, period, decay, pulse speed

### Live vs Rebuild

- `live: true` - Changes applied immediately without re-initialization
- `live: false` - Structural changes that may require rebuild (e.g., particle count, grid spacing)

## PostMessage Protocol

Communication between parent page and automa iframe:

### Parent → Automa

```typescript
// Initial setup
{ type: "automa:init", payload: { values: {...} } }

// Live parameter update
{ type: "automa:update", payload: { partialValues: {...} } }

// Structural change requiring rebuild
{ type: "automa:rebuild", payload: { values: {...} } }
```

### Automa → Parent

```typescript
// Automa is ready to receive messages
{ type: "automa:ready" }

// Optional telemetry (future)
{ type: "automa:telemetry", payload: { fps: 60 } }
```

## Adding a New Automa

### 1. Add Registry Entry

Edit `src/config/automa-registry.ts`:

```typescript
{
  id: "waves",
  slug: "waves",
  title: "Waves",
  theme: "Flow",
  description: "Flowing sine waves with phase shifts",
  schema: [
    {
      key: "frequency",
      label: "Frequency",
      type: "slider",
      group: "Motion",
      live: true,
      min: 1,
      max: 10,
      step: 0.5,
    },
    {
      key: "amplitude",
      label: "Amplitude",
      type: "slider",
      group: "Appearance",
      live: true,
      min: 10,
      max: 100,
      step: 5,
      unit: "px",
    },
  ],
  defaults: {
    frequency: 3,
    amplitude: 50,
  },
  renderer: {
    type: "component",
    component: "waves",
  },
}
```

### 2. Create Automa Component

Create `src/components/automa/renderers/waves.tsx`:

```typescript
import { useEffect, useRef } from "react";
import type { AutomaComponentProps } from "@/types/automa";

export function WavesAutoma({ values, width, height }: AutomaComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Your animation logic here
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const y = height / 2 + 
          Math.sin(x * values.frequency / 100) * values.amplitude;
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [values, width, height]);

  // Pause when hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ background: "#0a0a0a" }}
    />
  );
}
```

### 3. Register Component in Viewer

Add to `src/components/automa/automa-component-viewer.tsx`:

```typescript
import { WavesAutoma } from "./renderers/waves";

// In the renderAutoma() switch statement:
case "waves":
  return <WavesAutoma {...props} />;
```

### 4. Build and Test

```bash
npm run build
npm run preview
```

Navigate to `/explore` to see your new automa tile, or directly to `/automa/waves`.

## Current Automa

### Drift (Flow Theme)
- Calm drifting particles with directional flow
- Parameters: density, speed, direction, noise, size, intensity

### Lattice (Structure Theme)
- Geometric lattice with breathing deformation
- Parameters: spacing, deformation, pulse speed, thickness, intensity

### Pulse (Rhythm Theme)
- Concentric rings pulsing with falloff
- Parameters: rate, falloff, count, thickness, intensity

## Best Practices

1. **Keep automa simple** - Each should focus on one visual concept
2. **Use standard groups** - Stick to Motion, Geometry, Appearance, Timing
3. **Optimize performance** - Use requestAnimationFrame, pause when hidden
4. **Handle resize** - Always listen for window resize events
5. **Test live updates** - Ensure `live: true` parameters update smoothly
6. **Dark theme** - Use high contrast on dark background (#0a0a0a)
7. **Minimal styling** - Subtle, zen aesthetic with restrained effects

## File Structure

```
src/
├── components/
│   └── automa/
│       ├── control-*.tsx          # Individual control components
│       ├── control-section.tsx    # Collapsible sections
│       ├── controls-panel.tsx     # Main controls panel
│       ├── automa-viewer.tsx      # Iframe wrapper
│       └── automa-layout.tsx      # Page layout
├── config/
│   └── automa-registry.ts         # Automa definitions
├── pages/
│   ├── explore.astro              # Discovery page
│   └── automa/
│       └── [slug].astro           # Dynamic automa page
└── types/
    └── automa.ts                  # TypeScript definitions

public/
└── automa/
    ├── drift/
    │   └── index.html
    ├── lattice/
    │   └── index.html
    └── pulse/
        └── index.html
```

## Future Enhancements

- Telemetry (FPS monitoring)
- Preset system (save/load parameter sets)
- Screenshot/recording capabilities
- Automa search and filtering
- More themes (Chaos, Harmony, etc.)
- WebGL-based automa
- Audio-reactive parameters
