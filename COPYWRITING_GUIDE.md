# Automa Copywriting Guide

## Core Principles
1. **Consistency**: Same concept = same label across all automa
2. **Clarity**: User should understand what each control does
3. **Brevity**: Keep labels short but descriptive
4. **Hierarchy**: Related controls should have related names

---

## Unified Terminology

### Grid & Geometry
- **Cell Size** - Size of each grid cell (px)
- **Wall Fill Mode** - How the background wall is filled
  - Options: "Randomized" | "Fixed Text"
- **Script** - Character set for randomized fill
  - Options: "Alphabet" | "Chinese" | "Japanese" | "Korean"
- **Fixed Text** - Text that repeats across the wall (when mode = fixed)

### Text & Highlighting
- **Highlight Text** - The text that gets highlighted/emphasized
  - NOT: "Highlight Word (Mask)", "Highlight Text (Rasterized)", "Word Overlay"
- **Highlight Opacity** - Opacity of the highlighted text
- **Highlight Font** - Font style for highlighted text
- **Highlight Accent Color** - Color accent for highlights

### Brightness & Intensity
- **Wall Base Brightness** - Base brightness of background wall
- **Wall Peak Brightness** - Peak brightness of wall during sweep
- **Highlight Base Brightness** - Base brightness of highlight text
- **Highlight Peak Brightness** - Peak brightness of highlight during sweep
- **Wall Lift on Rain** - Brightness increase when rain passes

### Animation & Motion
- **Sweep Period** - Duration of one complete sweep cycle (s)
- **Sweep Half-Width** - Width of the sweep gradient (0-1)
- **Rain Speed** - Speed of falling rain (steps/sec)
- **Speed** - Generic animation speed

### Trail Effects (Matrix-specific)
- **Outside Trail Injection** - Rate of new trails outside highlight
- **Inside Trail Injection** - Rate of new trails inside highlight
- **Outside Fade Rate** - How fast trails fade outside highlight
- **Inside Fade Rate** - How fast trails fade inside highlight
- **Outside Trail Color** - Color of trails outside highlight

### Gradient & Colors
- **Sweep Gradient Profile** - The gradient curve for sweep intensity
  - Inline toggle: "Lock Ends" - Force gradient ends to 0
- **Background Color** - Canvas background color
- **Text Color** - Color of text/glyphs

### Wall Behavior
- **Wall Follow Multiplier** - How much highlight follows wall brightness
  - Parent control: "Highlight Base Brightness"
  - Inline toggle: "Follow Wall"
- **Wall Sweep Intensity** - Strength of sweep effect on wall
  - Parent control: "Highlight Peak Brightness"
  - Inline toggle: "Apply to Wall"

### Other
- **Twinkle Speed** - Speed of wall twinkle effect (FPS)
- **Highlight Glow Radius** - Glow radius around highlight hits (px)

---

## Inline Toggle Pattern

When a toggle modifies a parent slider:
```typescript
{
  key: "parentSlider",
  label: "Parent Control Name",
  type: "slider",
  inlineToggle: {
    key: "childToggle",
    label: "Short Toggle Label", // e.g., "Follow Wall", "Apply to Wall"
  }
}
```

The toggle itself should have a descriptive standalone label:
```typescript
{
  key: "childToggle",
  label: "Full Descriptive Label", // e.g., "Follow Wall (if Base = 0)"
  type: "toggle",
}
```

---

## Examples of Fixes

### ❌ Before (Inconsistent)
- Matrix: "Highlight Text"
- Shimmer: "Highlight Text (Rasterized)"
- Sweep: "Highlight Word (Mask)"

### ✅ After (Unified)
- All: "Highlight Text"

---

### ❌ Before (Inconsistent)
- Matrix: "Word Overlay Opacity"
- Shimmer: (none)
- Sweep: "Highlight Opacity"

### ✅ After (Unified)
- All: "Highlight Opacity"

---

### ❌ Before (Inconsistent)
- Shimmer: "Wall Brightness"
- Sweep: "Wall Base Brightness"

### ✅ After (Unified)
- All: "Wall Base Brightness"

---

### ❌ Before (Inconsistent)
- Shimmer: "Text Base Brightness"
- Shimmer: "Text Peak Brightness"

### ✅ After (Unified)
- All: "Highlight Base Brightness"
- All: "Highlight Peak Brightness"

---

## Status: ✅ Applied

All automa have been updated to follow this guide.
