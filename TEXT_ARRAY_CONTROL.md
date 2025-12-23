# Text Array Control Feature

## Overview

Replaced comma-separated text input with a dynamic array control featuring +/- buttons for managing multiple fixed texts across all typography automas.

## Problem

Previously, users had to enter multiple texts as comma-separated values in a single text field:
- Not intuitive
- Hard to edit individual texts
- No visual indication of how many texts are active

## Solution

Implemented a new `text-array` control type with:
- Individual text input for each entry
- **+ button** to add new texts
- **− button** to remove texts (minimum 1 text required)
- Clean, card-based UI matching the existing control aesthetic

## Implementation

### 1. New Control Type

**File:** `src/types/automa.ts`

Added `"text-array"` to `ParameterType`:

```typescript
export type ParameterType = "slider" | "number" | "select" | "toggle" | "text" | "color" | "gradient" | "text-array";
```

### 2. UI Component

**File:** `src/components/automa/control-text-array.tsx`

New React component that:
- Accepts `value: string[]` prop
- Renders individual text inputs for each entry
- Shows remove button (−) when multiple texts exist
- Shows add button (+) at the bottom to add new entries
- Maintains at least one text input at all times

### 3. Controls Panel Integration

**File:** `src/components/automa/controls-panel.tsx`

Added `text-array` case to the switch statement:

```typescript
case "text-array":
  control = (
    <ControlTextArray
      parameter={param}
      value={value}
      onChange={(v) => handleChange(param.key, v, param.live)}
    />
  );
  break;
```

### 4. Schema Updates

**File:** `src/config/automa-registry.ts`

Updated all three typography automas (Matrix Trails, Shimmer Wall, Sweep Highlight):

**Before:**
```typescript
{
  key: "fixedText",
  type: "text",
  placeholder: "你好世界, Hello, 안녕",
}
```

**After:**
```typescript
{
  key: "fixedText",
  type: "text-array",
  placeholder: "你好世界",
}
```

**Defaults changed from:**
```typescript
fixedText: "你好世界"
```

**To:**
```typescript
fixedText: ["你好世界"]
```

### 5. Renderer Updates

**Files:**
- `src/components/automa/renderers/matrix-trails.tsx`
- `src/components/automa/renderers/shimmer-wall.tsx`
- `src/components/automa/renderers/sweep-highlight.tsx`

Updated `buildFixedPool` function to accept both array and legacy string formats:

```typescript
function buildFixedPool(textArray: string[] | string, orientation: string = "horizontal"): Uint32Array {
  // Handle both array and legacy string format
  let texts: string[];
  if (Array.isArray(textArray)) {
    texts = textArray.map(t => t.trim()).filter(t => t.length > 0);
  } else {
    const cleaned = (textArray && textArray.trim()) || "你好世界";
    texts = cleaned.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
  // ... process texts
}
```

This maintains backward compatibility if any legacy configs exist.

## UI/UX

### Layout

```
┌─────────────────────────────────────┐
│ Fixed Text                          │
├─────────────────────────────────────┤
│ [你好世界              ] [−]        │
│ [Hello                 ]            │
│ [안녕                   ] [−]        │
│                                     │
│ [+ Add Text]                        │
└─────────────────────────────────────┘
```

### Features

1. **Individual Inputs**: Each text gets its own input field
2. **Remove Button**: Shows on all entries when count > 1
3. **Add Button**: Always visible at the bottom
4. **Minimum One**: Cannot remove the last remaining text
5. **Consistent Styling**: Matches existing control aesthetic with borders, hover states

## Benefits

1. **Intuitive UX**: Clear visual representation of multiple texts
2. **Easy Management**: Add/remove individual texts without parsing
3. **Flexible**: Users can have as many alternating texts as needed
4. **Professional**: Modern UI pattern with +/− buttons
5. **Backward Compatible**: Renderers handle both array and comma-separated legacy format

## Testing

Navigate to any typography automa:
1. Set Wall Fill Mode to "Fixed Text"
2. See the initial text input with "你好世界"
3. Click **+ Add Text** to add more entries
4. Enter different texts in each field
5. Click **−** to remove unwanted entries
6. Observe the alternating pattern across the grid

## Files Modified

1. `src/types/automa.ts` - Added text-array type
2. `src/components/automa/control-text-array.tsx` - New component
3. `src/components/automa/controls-panel.tsx` - Added text-array case
4. `src/config/automa-registry.ts` - Updated all typography schemas
5. `src/components/automa/renderers/matrix-trails.tsx` - Updated buildFixedPool
6. `src/components/automa/renderers/shimmer-wall.tsx` - Updated buildFixedPool
7. `src/components/automa/renderers/sweep-highlight.tsx` - Updated buildFixedPool

## Status: ✅ Complete

All typography automas now support dynamic text array management with an intuitive UI.
