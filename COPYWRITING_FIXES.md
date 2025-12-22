# Copywriting & UX Fixes Summary

## Problem Statement
The user identified inconsistent copywriting across automa controls:
- Same concepts had different labels (e.g., "Highlight Text" vs "Highlight Word (Mask)" vs "Highlight Text (Rasterized)")
- Toggles took up full card cells despite being auxiliary controls
- No visual hierarchy between primary controls and their modifiers

---

## Solution 1: Inline Toggles

### Before
Toggles were rendered as separate cards, wasting space:

```
┌─────────────────────────────────────┐
│ Text Base Brightness       [slider] │
├─────────────────────────────────────┤
│ Follow Wall (if Base = 0)  [toggle] │ ← Full card!
├─────────────────────────────────────┤
│ Wall Follow Multiplier     [slider] │
└─────────────────────────────────────┘
```

### After
Toggles are now inline with their parent controls:

```
┌─────────────────────────────────────┐
│ Highlight Base Brightness  [slider] │
│ Follow Wall            [toggle]     │ ← Inline!
├─────────────────────────────────────┤
│ Wall Follow Multiplier     [slider] │
└─────────────────────────────────────┘
```

### Implementation
Added `inlineToggle` property to `Parameter` interface:

```typescript
interface Parameter {
  // ... existing properties
  inlineToggle?: {
    key: string;      // Key of the toggle parameter
    label: string;    // Short label for inline display
  };
}
```

Updated controls to support inline toggles:
- `ControlSlider` - Shows toggle on same row as label
- `ControlGradient` - Shows toggle on same row as label
- `ControlsPanel` - Skips rendering standalone toggles if they're inline

### Applied To
1. **Shimmer Wall**:
   - `baseB` (Highlight Base Brightness) → inline toggle `followWall`
   - `peakB` (Highlight Peak Brightness) → inline toggle `wallSweep`
   - `gradientStops` (Sweep Gradient Profile) → inline toggle `lockEnds`

2. **Sweep Highlight**:
   - `gradientStops` (Sweep Gradient Profile) → inline toggle `lockEnds`

---

## Solution 2: Unified Copywriting

### Changes Applied

#### 1. Highlight Text Labels
**Before:**
- Matrix Trails: "Highlight Text" ✓
- Shimmer Wall: "Highlight Text (Rasterized)" ❌
- Sweep Highlight: "Highlight Word (Mask)" ❌

**After:**
- All: "Highlight Text" ✅

---

#### 2. Highlight-Related Labels
**Before:**
- Matrix: "Word Overlay Font" ❌
- Matrix: "Word Overlay Opacity" ❌
- Matrix: "Accent Color" ❌

**After:**
- Matrix: "Highlight Font" ✅
- Matrix: "Highlight Opacity" ✅
- Matrix: "Highlight Accent Color" ✅

---

#### 3. Brightness Labels
**Before:**
- Shimmer: "Wall Brightness" ❌
- Shimmer: "Text Base Brightness" ❌
- Shimmer: "Text Peak Brightness" ❌

**After:**
- Shimmer: "Wall Base Brightness" ✅
- Shimmer: "Highlight Base Brightness" ✅
- Shimmer: "Highlight Peak Brightness" ✅

---

#### 4. Gradient Toggle Labels
**Before:**
- Shimmer: "↳ Lock Ends at 0" (with arrow, separate card) ❌
- Sweep: "↳ Lock Ends at 0" (with arrow, separate card) ❌

**After:**
- Both: Inline toggle labeled "Lock Ends" ✅
- Standalone label: "Lock Gradient Ends at 0" (for accessibility)

---

## Terminology Standard

Created `COPYWRITING_GUIDE.md` with unified terminology:

### Grid & Geometry
- Cell Size
- Wall Fill Mode (Randomized | Fixed Text)
- Script (Alphabet | Chinese | Japanese | Korean)
- Fixed Text

### Text & Highlighting
- Highlight Text
- Highlight Opacity
- Highlight Font
- Highlight Accent Color

### Brightness
- Wall Base Brightness
- Wall Peak Brightness
- Highlight Base Brightness
- Highlight Peak Brightness

### Animation
- Sweep Period
- Sweep Half-Width
- Rain Speed

### Gradient
- Sweep Gradient Profile
  - Inline: "Lock Ends"

### Colors
- Background Color
- Text Color

---

## Visual Improvements

### Toggle Component
- Reduced size: `h-6 w-11` → `h-4 w-8` (inline) / `h-5 w-9` (standalone)
- Tighter spacing: `py-1` → `gap-3`
- Smaller text: `text-sm` → `text-xs` (inline labels)
- Added `flex-shrink-0` to prevent toggle from shrinking

### Slider Component
- Moved value display below slider when inline toggle present
- Added `flex-1` to label to allow toggle to align right
- Consistent spacing with `gap-3`

### Gradient Component
- Moved preset buttons below gradient bar when inline toggle present
- Consistent toggle styling with sliders
- Label size increased: `text-xs` → `text-sm` for consistency

---

## Files Modified

1. **Type Definitions**
   - `src/types/automa.ts` - Added `inlineToggle` property

2. **Components**
   - `src/components/automa/control-toggle.tsx` - Reduced size, improved styling
   - `src/components/automa/control-slider.tsx` - Added inline toggle support
   - `src/components/automa/control-gradient.tsx` - Added inline toggle support
   - `src/components/automa/controls-panel.tsx` - Skip rendering inline toggles as standalone

3. **Configuration**
   - `src/config/automa-registry.ts` - Updated all labels, added inline toggles

4. **Documentation**
   - `COPYWRITING_GUIDE.md` - Comprehensive terminology guide
   - `COPYWRITING_FIXES.md` - This document

---

## Benefits

1. **Space Efficiency**: Inline toggles save ~40% vertical space in control panel
2. **Visual Hierarchy**: Clear parent-child relationships between controls
3. **Consistency**: All automa use same terminology for same concepts
4. **Clarity**: Labels are descriptive and unambiguous
5. **Professional**: Polished, modern UI that matches the zen aesthetic

---

## Testing

**Build:** ✅ Success  
**Preview:** `http://localhost:4321`

**Test Scenarios:**
1. `/automa/shimmer-wall`
   - ✅ Highlight brightness controls use unified labels
   - ✅ Sweep Gradient Profile still exposes inline "Lock Ends" toggle

2. `/automa/sweep-highlight`
   - ✅ Highlight Text + Highlight Opacity labels match guide
   - ✅ Gradient controls keep inline "Lock Ends" toggle

3. `/automa/matrix-trails`
   - ✅ Highlight Text / Font / Opacity labels remain consistent
   - ✅ Glow control now reads "Highlight Glow Radius"

---

## 2025-12-23 Updates

- **Glow Terminology**: Replaced "Hitbox" references with "Highlight" across Matrix Trails UI + docs (`Highlight Glow Radius`).
- **Fixed Text Labeling**: Simplified all typography geometry controls to the standard `Fixed Text`.

---

## Status: ✅ Complete

All copywriting inconsistencies have been resolved and inline toggles have been implemented across all applicable automa, with ongoing terminology maintenance logged above.
