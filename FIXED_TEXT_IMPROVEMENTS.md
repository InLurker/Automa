# Fixed Text Improvements

## Overview

Added two major enhancements to the Fixed Text feature across all typography automas (Matrix Trails, Shimmer Wall, and Sweep Highlight):

1. **Text Orientation Control** - Vertical/Horizontal layout
2. **Alternating Texts** - Multiple comma-separated texts that repeat

## Features

### 1. Text Orientation

Users can now choose between **Horizontal** and **Vertical** text orientation:

- **Horizontal** (default): Characters fill left-to-right, row-by-row (row-major order)
- **Vertical**: Characters fill top-to-bottom, column-by-column (column-major order)

**Example with "Hello":**
- Horizontal: Characters repeat across rows → `HelloHelloHello...`
- Vertical: Characters repeat down columns:
  ```
  H H H ...
  e e e ...
  l l l ...
  l l l ...
  o o o ...
  ```

### 2. Alternating Texts

Users can specify multiple texts separated by commas. The texts will repeat in sequence across the grid:

**Example:**
- Input: `"你好世界, Hello, 안녕"`
- Output: Characters cycle through all three texts with spaces between them

**Combining with Vertical:**
- Input: `"Hello, World"` with vertical orientation
- Output:
  ```
  H
  e
  l
  l
  o
   
  W
  o
  r
  l
  d
  ```

## Implementation

### Schema Changes

Added new control to all typography automas:

```typescript
{
  key: "textOrientation",
  label: "Text Orientation",
  type: "select",
  group: "Geometry",
  live: false,
  visibleWhen: {
    key: "fillMode" / "bgType",
    value: "fixed",
  },
  options: [
    { label: "Horizontal", value: "horizontal" },
    { label: "Vertical", value: "vertical" },
  ],
}
```

### Defaults

- All typography automas now default to `textOrientation: "horizontal"`
- Fixed Text placeholder updated to: `"你好世界, Hello, 안녕"` to hint at comma-separated functionality

### buildFixedPool Function

Created unified helper function used by all three renderers:

```typescript
function buildFixedPool(str: string, orientation: string = "horizontal"): Uint32Array {
  const cleaned = (str && str.trim()) || "你好世界";
  
  // Split by comma to get multiple alternating texts
  const texts = cleaned.split(',').map(t => t.trim()).filter(t => t.length > 0);
  if (!texts.length) return new Uint32Array([0x4e00]);
  
  const result: number[] = [];
  
  for (const text of texts) {
    const chars = Array.from(text);
    if (orientation === "vertical") {
      // Insert newline (codepoint 10) between each character
      for (let i = 0; i < chars.length; i++) {
        const cp = chars[i].codePointAt(0) || 63;
        result.push(cp);
        if (i < chars.length - 1) {
          result.push(10); // newline
        }
      }
    } else {
      // Horizontal: just add all characters
      for (const char of chars) {
        result.push(char.codePointAt(0) || 63);
      }
    }
    
    // Add space (codepoint 32) between alternating texts
    if (texts.indexOf(text) < texts.length - 1) {
      result.push(32);
    }
  }
  
  return Uint32Array.from(result);
}
```

### Renderer Updates

All three renderers now:
1. Use the unified `buildFixedPool` function
2. Pass `textOrientation` parameter from values
3. Include `textOrientation` in their dependency arrays for proper rebuilds

## Files Modified

1. **Schema & Defaults**
   - `src/config/automa-registry.ts` - Added `textOrientation` control and updated placeholders for all typography automas

2. **Renderers**
   - `src/components/automa/renderers/matrix-trails.tsx` - Added `buildFixedPool`, updated rebuild logic
   - `src/components/automa/renderers/shimmer-wall.tsx` - Added `buildFixedPool`, updated rebuild logic
   - `src/components/automa/renderers/sweep-highlight.tsx` - Added `buildFixedPool`, updated rebuild logic

## Usage Examples

### Example 1: Multilingual Alternating Text
```
Inputs: ["你好", "Hello", "안녕", "こんにちは"]
Mode: Fixed Text, Horizontal
Result: Characters cycle through all four greetings
```

### Example 2: Multiple Words
```
Inputs: ["ALICE", "BOB", "CAROL"]
Mode: Fixed Text
Result: Three names alternating with spaces between
```

### Example 3: Mixed Script
```
Inputs: ["日本", "Japan", "일본"]
Mode: Fixed Text, Horizontal
Result: Japanese, English, and Korean alternating
```

## Update: Text Array Control

The comma-separated input has been replaced with a **text-array control** featuring:
- Individual input fields for each text
- **+ button** to add new texts
- **− button** to remove texts
- Minimum one text required

See `TEXT_ARRAY_CONTROL.md` for detailed documentation.

## Benefits

1. **Creative Flexibility** - Users can create more varied and interesting patterns
2. **Multilingual Support** - Easy to showcase multiple languages simultaneously
3. **Vertical Layout** - Opens up new design possibilities for vertical text traditions
4. **Simple API** - Comma separation is intuitive and familiar

## Testing

Navigate to any typography automa and:
1. Set Wall Fill Mode to "Fixed Text"
2. Enter comma-separated texts: `"你好世界, Hello, 안녕"`
3. Toggle between Horizontal and Vertical orientation
4. Observe the repeating pattern across the grid

## Status: ✅ Complete

All typography automas now support text orientation and alternating texts with a unified implementation.
