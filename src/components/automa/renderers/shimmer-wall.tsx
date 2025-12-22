import { useEffect, useRef, useMemo, useCallback } from "react";
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

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
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

interface GradientStop {
  p: number; // position 0-1
  v: number; // value 0-1
}

export function ShimmerWallAutoma({
  values,
  width,
  height,
  isPaused,
}: AutomaComponentProps & { isPaused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const animationRef = useRef<number>();
  const waveOffsetRef = useRef(Math.random());

  // Grid state
  const gridRef = useRef<{
    cols: number;
    rows: number;
    cell: number;
    chars: Uint32Array;
    twPhase: Float32Array;
    twSpeed: Float32Array;
    hiByCol: Uint32Array[];
    xCenter: Float32Array;
    yCenter: Float32Array;
  }>({
    cols: 0,
    rows: 0,
    cell: 16,
    chars: new Uint32Array(0),
    twPhase: new Float32Array(0),
    twSpeed: new Float32Array(0),
    hiByCol: [],
    xCenter: new Float32Array(0),
    yCenter: new Float32Array(0),
  });

  // Memoize colors to avoid recalculating on every frame
  const colors = useMemo(
    () => ({
      background: values.backgroundColor || "#000000",
      text: values.textColor || "#ffffff",
    }),
    [values.backgroundColor, values.textColor]
  );

  // Parse gradient stops from JSON string or use default - MEMOIZED
  const gradientStops = useMemo((): GradientStop[] => {
    try {
      if (values.gradientStops && typeof values.gradientStops === "string") {
        const parsed = JSON.parse(values.gradientStops);
        if (Array.isArray(parsed)) {
          return parsed.map((s: any) => ({
            p: clamp(Number(s.p) || 0, 0, 1),
            v: clamp(Number(s.v) || 0, 0, 1),
          }));
        }
      }
    } catch {}

    // Default stops
    return [
      { p: 0.0, v: 0.0 },
      { p: 0.2, v: 0.1 },
      { p: 0.5, v: 0.8 },
      { p: 0.8, v: 0.1 },
      { p: 1.0, v: 0.0 },
    ];
  }, [values.gradientStops]);

  // Evaluate gradient at position u - MEMOIZED FUNCTION
  const evalGradient = useCallback(
    (u: number, lockEnds: boolean): number => {
      if (lockEnds && (u <= 0 || u >= 1)) return 0;
      if (!gradientStops.length) return 0;

      const sorted = [...gradientStops].sort((a, b) => a.p - b.p);

      if (u <= sorted[0].p) return sorted[0].v;
      const last = sorted[sorted.length - 1];
      if (u >= last.p) return last.v;

      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i],
          b = sorted[i + 1];
        if (u >= a.p && u <= b.p) {
          const t = (u - a.p) / Math.max(1e-6, b.p - a.p);
          return a.v + (b.v - a.v) * t;
        }
      }
      return 0;
    },
    [gradientStops]
  );

  // Rasterize text to mask - SEPARATED from rebuild
  const rasterizeTextToMask = useCallback(
    (word: string, cols: number, rows: number) => {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (!maskCtx || !cols || !rows) return;

      maskCanvas.width = cols;
      maskCanvas.height = rows;
      maskCtx.clearRect(0, 0, cols, rows);

      const cleaned = (word || " ").replace(/\r\n?/g, "\n").replace(/\\n/g, "\n");
      const lines = cleaned.split("\n").map((l) => (l.length ? l : " "));

      const maxW = cols * 0.9;
      const maxH = rows * 0.9;
      const families = '"Times New Roman","Georgia","Times",serif';
      let size = Math.max(4, Math.min(cols, rows));

      function measure(sz: number) {
        maskCtx.font = `700 ${sz}px ${families}`;
        let maxLineWidth = 1,
          maxA = 0,
          maxD = 0;
        const per = [];
        for (const line of lines) {
          const m = maskCtx.measureText(line);
          const left = m.actualBoundingBoxLeft ?? 0;
          const right = m.actualBoundingBoxRight ?? (m.width ?? 0);
          const width = Math.max(m.width || 0, left + right, 1);
          const a = m.actualBoundingBoxAscent || sz * 0.8;
          const d = m.actualBoundingBoxDescent || sz * 0.2;
          maxLineWidth = Math.max(maxLineWidth, width);
          maxA = Math.max(maxA, a);
          maxD = Math.max(maxD, d);
          per.push({ a, d });
        }
        const lead = sz * 0.2;
        const lh = maxA + maxD + lead;
        const first = per[0],
          last = per[per.length - 1];
        const totalH = first.a + last.d + Math.max(0, per.length - 1) * lh;
        return { maxLineWidth, totalH, lh, per };
      }

      let m = measure(size);
      for (let i = 0; i < 7; i++) {
        const scale = Math.min(maxW / m.maxLineWidth, maxH / Math.max(1, m.totalH));
        if (scale >= 0.995) break;
        size = Math.max(4, size * scale);
        m = measure(size);
      }

      maskCtx.fillStyle = "#fff";
      maskCtx.textAlign = "center";
      maskCtx.textBaseline = "alphabetic";
      maskCtx.font = `700 ${size}px ${families}`;

      const first = m.per[0],
        last = m.per[m.per.length - 1];
      const totalH = first.a + last.d + Math.max(0, lines.length - 1) * m.lh;
      let y = rows / 2 - totalH / 2 + first.a;

      for (let i = 0; i < lines.length; i++) {
        maskCtx.fillText(lines[i], cols / 2, y);
        y += m.lh;
      }

      const data = maskCtx.getImageData(0, 0, cols, rows).data;
      const tmp = Array.from({ length: cols }, () => [] as number[]);
      const TH = 64;
      const total = cols * rows;
      for (let i = 0; i < total; i++) {
        if (data[i * 4 + 3] > TH) tmp[i % cols].push(i);
      }
      gridRef.current.hiByCol = tmp.map((arr) => Uint32Array.from(arr));
    },
    []
  );

  // Rebuild grid - ONLY for geometry changes
  const rebuild = useCallback(() => {
    const grid = gridRef.current;
    grid.cell = Math.max(8, values.cellSize || 16);

    grid.cols = Math.max(1, Math.ceil(width / grid.cell));
    grid.rows = Math.max(1, Math.ceil(height / grid.cell));
    const total = grid.cols * grid.rows;

    grid.chars = new Uint32Array(total);
    grid.twPhase = new Float32Array(total);
    grid.twSpeed = new Float32Array(total);
    grid.xCenter = new Float32Array(grid.cols);
    grid.yCenter = new Float32Array(grid.rows);

    // Precompute cell centers
    for (let c = 0; c < grid.cols; c++) {
      grid.xCenter[c] = c * grid.cell + grid.cell / 2;
    }
    for (let r = 0; r < grid.rows; r++) {
      grid.yCenter[r] = r * grid.cell + grid.cell / 2;
    }

    const mode = values.fillMode || "random";
    const script = values.lang || "chinese";
    const fixedStr = (values.fixedText && values.fixedText.trim()) || "你好世界";
    const fixedCps = Array.from(fixedStr);
    const fixedLen = fixedCps.length || 1;
    let fi = 0;

    for (let i = 0; i < total; i++) {
      const cp =
        mode === "random"
          ? randomChar(script)
          : fixedCps[fi++ % fixedLen].codePointAt(0) || 63;
      grid.chars[i] = cp;
      grid.twPhase[i] = Math.random() * Math.PI * 2;
      grid.twSpeed[i] = 0.15 + Math.random() * 0.35;
    }

    rasterizeTextToMask(values.mainText || "你好", grid.cols, grid.rows);
  }, [width, height, values.cellSize, values.fillMode, values.lang, values.fixedText, values.mainText, rasterizeTextToMask]);

  // Main draw loop - MEMOIZED
  const draw = useCallback(
    (ts: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const grid = gridRef.current;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fontPx = Math.max(6, grid.cell - 4);

      const bgB = clamp(values.bgB ?? 0.06, 0, 0.25);
      let baseB = clamp(values.baseB ?? 0.12, 0, 1);
      const peakB = clamp(values.peakB ?? 1.0, 0, 1);
      const halfW = clamp(values.sweepHalfWidth ?? 0.22, 0.05, 0.5);

      const periodSec = Math.max(0.4, values.speed ?? 6);
      const period = periodSec * 1000;
      const t = ((ts / period) + waveOffsetRef.current) % 1;

      const overscan = halfW + 0.1;
      const center = -overscan + t * (1 + 2 * overscan);
      const denom = Math.max(1, grid.cols - 1);

      const time = ts * 0.001;

      // Parse text color with alpha
      const textColorRgba = hexToRgba(colors.text, 1);

      // Draw background wall
      ctx.font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Noto Sans Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const wallSweepEnabled = values.wallSweep ?? false;
      const wallSweepStrength = clamp(values.wallSweepStrength ?? 0.3, 0, 1);

      for (let r = 0; r < grid.rows; r++) {
        const y = grid.yCenter[r];
        if (y < -grid.cell || y > height + grid.cell) continue;
        for (let c = 0; c < grid.cols; c++) {
          const x = grid.xCenter[c];
          if (x < -grid.cell || x > width + grid.cell) continue;
          const i = r * grid.cols + c;
          const tw = 0.86 + 0.14 * Math.sin(grid.twPhase[i] + time * grid.twSpeed[i]);
          
          let brightness = bgB * tw;
          
          // Add sweep effect to wall if enabled
          if (wallSweepEnabled) {
            const rx = grid.cols > 1 ? c / denom : 0;
            const left = center - halfW;
            const u = (rx - left) / Math.max(1e-6, 2 * halfW);
            const intensity = clamp(evalGradient(u, lockEnds), 0, 1);
            // Use a reasonable max boost for wall (not the full peakB which is for highlight)
            const maxWallBoost = clamp(0.15, 0, 0.5); // Cap wall sweep boost
            const sweepBoost = maxWallBoost * intensity * wallSweepStrength;
            brightness += sweepBoost;
          }
          
          ctx.fillStyle = hexToRgba(colors.text, brightness);
          ctx.fillText(String.fromCodePoint(grid.chars[i]), x, y);
        }
      }

      // Draw highlight text
      ctx.font = `700 ${fontPx}px "Times New Roman","Georgia","Times",serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Pass A: base text
      if (baseB > 0.0005) {
        ctx.fillStyle = hexToRgba(colors.text, baseB);
        for (let c = 0; c < grid.cols; c++) {
          const idxs = grid.hiByCol[c];
          if (!idxs || idxs.length === 0) continue;
          for (let k = 0; k < idxs.length; k++) {
            const i = idxs[k];
            const r = Math.floor(i / grid.cols);
            ctx.fillText(
              String.fromCodePoint(grid.chars[i]),
              grid.xCenter[c],
              grid.yCenter[r]
            );
          }
        }
      }

      // Pass B: sweep boost
      const boostMax = Math.max(0, peakB - baseB);
      if (boostMax > 0.0005) {
        const lockEnds = values.lockEnds ?? true;

        for (let c = 0; c < grid.cols; c++) {
          const idxs = grid.hiByCol[c];
          if (!idxs || idxs.length === 0) continue;

          const rx = grid.cols > 1 ? c / denom : 0;
          const left = center - halfW;
          const u = (rx - left) / Math.max(1e-6, 2 * halfW);
          const intensity = clamp(evalGradient(u, lockEnds), 0, 1);

          const alpha = boostMax * intensity;
          if (alpha <= 0.0005) continue;

          ctx.fillStyle = hexToRgba(colors.text, alpha);
          for (let k = 0; k < idxs.length; k++) {
            const i = idxs[k];
            const r = Math.floor(i / grid.cols);
            ctx.fillText(
              String.fromCodePoint(grid.chars[i]),
              grid.xCenter[c],
              grid.yCenter[r]
            );
          }
        }
      }
    },
    [
      width,
      height,
      values.bgB,
      values.baseB,
      values.peakB,
      values.sweepHalfWidth,
      values.speed,
      values.followWall,
      values.followMul,
      values.lockEnds,
      values.wallSweep,
      values.wallSweepStrength,
      colors,
      evalGradient,
    ]
  );

  // EFFECT 1: Rebuild on GEOMETRY changes only
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const cw = Math.floor(width * dpr);
    const ch = Math.floor(height * dpr);
    canvas.width = cw;
    canvas.height = ch;

    rebuild();
  }, [width, height, values.cellSize, values.fillMode, values.lang, values.fixedText, rebuild]);

  // EFFECT 2: Rasterize mask on text change (no rebuild needed!)
  useEffect(() => {
    const grid = gridRef.current;
    if (grid.cols > 1) {
      rasterizeTextToMask(values.mainText || "你好", grid.cols, grid.rows);
    }
  }, [values.mainText, rasterizeTextToMask]);

  // EFFECT 3: Reset wave offset on speed change
  useEffect(() => {
    waveOffsetRef.current = Math.random();
  }, [values.speed]);

  // EFFECT 4: Main animation loop
  useEffect(() => {
    if (isPaused) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const loop = (ts: number) => {
      draw(ts || performance.now());
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPaused, draw]);

  // Visibility handling
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
      className="w-full h-full block"
      style={{ background: colors.background }}
    />
  );
}
