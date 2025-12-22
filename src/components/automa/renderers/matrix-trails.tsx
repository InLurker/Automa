import { useEffect, useRef, useMemo, useCallback } from "react";
import type { AutomaComponentProps } from "@/types/automa";

// Glyph generation helpers
function randomWallCodepoint(script: string): number {
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

function buildFixedPool(str: string): Uint32Array {
  const cleaned = (str && str.trim()) || "你好世界";
  const arr = Array.from(cleaned);
  if (!arr.length) return new Uint32Array([0x4e00]);
  const cps = new Uint32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    cps[i] = arr[i].codePointAt(0) || 63;
  }
  return cps;
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

export function MatrixTrailsAutoma({
  values,
  width,
  height,
  isPaused,
}: AutomaComponentProps & { isPaused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const animationRef = useRef<number>();

  // Grid state
  const gridRef = useRef<{
    cols: number;
    rows: number;
    cell: number;
    xCenter: Float32Array;
    yCenter: Float32Array;
    wallChars: Uint32Array;
    baseChars: Uint32Array;
    twPhase: Float32Array;
    twSpeed: Float32Array;
    hitMask: Uint8Array;
    hiByCol: Uint32Array[];
    trail: Float32Array;
    active: number[];
    activeFlag: Uint8Array;
    dropPos: Float32Array;
    dropSpd: Float32Array;
    fixedPool: Uint32Array;
    glyphCache: Map<number, string>;
  }>({
    cols: 1,
    rows: 1,
    cell: 16,
    xCenter: new Float32Array(0),
    yCenter: new Float32Array(0),
    wallChars: new Uint32Array(0),
    baseChars: new Uint32Array(0),
    twPhase: new Float32Array(0),
    twSpeed: new Float32Array(0),
    hitMask: new Uint8Array(0),
    hiByCol: [],
    trail: new Float32Array(0),
    active: [],
    activeFlag: new Uint8Array(0),
    dropPos: new Float32Array(0),
    dropSpd: new Float32Array(0),
    fixedPool: new Uint32Array(0),
    glyphCache: new Map(),
  });

  const lastRef = useRef(0);
  const accRef = useRef(0);

  // Memoize colors to avoid recalculating on every frame
  const colors = useMemo(
    () => ({
      background: values.backgroundColor || "#000000",
      accent: values.accentColor || "#86ffd0",
      outsideTrail: values.outsideTrailColor || "#008c3c",
    }),
    [values.backgroundColor, values.accentColor, values.outsideTrailColor]
  );

  // Helper: get glyph string from codepoint
  const glyph = useCallback((cp: number): string => {
    const cache = gridRef.current.glyphCache;
    let s = cache.get(cp);
    if (!s) {
      s = String.fromCodePoint(cp);
      cache.set(cp, s);
    }
    return s;
  }, []);

  // Helper: replacement codepoint based on mode
  const replacementCodepoint = useCallback((): number => {
    const mode = values.fillMode || "random";
    if (mode === "random") {
      return randomWallCodepoint(values.script || "chinese");
    }
    const pool = gridRef.current.fixedPool;
    if (pool.length) {
      return pool[(Math.random() * pool.length) | 0];
    }
    return 63;
  }, [values.fillMode, values.script]);

  // Rasterize hitbox mask - SEPARATED from rebuild
  const rasterizeHitMask = useCallback(
    (word: string, cols: number, rows: number) => {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (!maskCtx || !cols || !rows) return;

      maskCanvas.width = cols;
      maskCanvas.height = rows;
      maskCtx.clearRect(0, 0, cols, rows);

      const cleaned = (word || " ").replace(/\r\n?/g, "\n").replace(/\\n/g, "\n");
      const lines = cleaned.split("\n").map((l) => (l.length ? l : " "));

      const families = '"Times New Roman","Georgia","Times",serif';
      let size = Math.max(4, Math.min(cols, rows));
      const maxW = cols * 0.9;
      const maxH = rows * 0.9;

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
      const total = cols * rows;
      const grid = gridRef.current;
      if (grid.hitMask.length !== total) grid.hitMask = new Uint8Array(total);

      const tmp = Array.from({ length: cols }, () => [] as number[]);
      const TH = 64;
      for (let i = 0; i < total; i++) {
        const on = data[i * 4 + 3] > TH;
        grid.hitMask[i] = on ? 1 : 0;
        if (on) tmp[i % cols].push(i);
      }
      grid.hiByCol = tmp.map((a) => Uint32Array.from(a));
    },
    []
  );

  // Rebuild grid - ONLY for geometry changes
  const rebuildAll = useCallback(() => {
    const grid = gridRef.current;
    grid.cell = Math.max(8, values.cellSize || 16);

    grid.cols = Math.max(1, Math.ceil(width / grid.cell));
    grid.rows = Math.max(1, Math.ceil(height / grid.cell));
    const total = grid.cols * grid.rows;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const cw = Math.floor(width * dpr);
    const ch = Math.floor(height * dpr);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = cw;
      canvas.height = ch;
    }

    maskCanvasRef.current.width = grid.cols;
    maskCanvasRef.current.height = grid.rows;

    // Centers
    grid.xCenter = new Float32Array(grid.cols);
    grid.yCenter = new Float32Array(grid.rows);
    for (let c = 0; c < grid.cols; c++) grid.xCenter[c] = c * grid.cell + grid.cell / 2;
    for (let r = 0; r < grid.rows; r++) grid.yCenter[r] = r * grid.cell + grid.cell / 2;

    // Wall chars
    grid.wallChars = new Uint32Array(total);
    grid.baseChars = new Uint32Array(total);
    grid.twPhase = new Float32Array(total);
    grid.twSpeed = new Float32Array(total);

    // Trails
    grid.trail = new Float32Array(total);
    grid.activeFlag = new Uint8Array(total);
    grid.active = [];

    // Drops
    grid.dropPos = new Float32Array(grid.cols);
    grid.dropSpd = new Float32Array(grid.cols);
    for (let c = 0; c < grid.cols; c++) {
      grid.dropPos[c] = Math.random() * grid.rows;
      grid.dropSpd[c] = 0.6 + Math.random() * 1.4;
    }

    grid.fixedPool = buildFixedPool(values.fixedText || "你好世界");

    const mode = values.fillMode || "random";
    const script = values.script || "chinese";

    if (mode === "fixed") {
      const pool = grid.fixedPool.length ? grid.fixedPool : new Uint32Array([63]);
      for (let i = 0; i < total; i++) {
        const cp = pool[i % pool.length];
        grid.wallChars[i] = cp;
        grid.baseChars[i] = cp;
        grid.twPhase[i] = Math.random() * Math.PI * 2;
        grid.twSpeed[i] = 0.15 + Math.random() * 0.35;
      }
    } else {
      for (let i = 0; i < total; i++) {
        const cp = randomWallCodepoint(script);
        grid.wallChars[i] = cp;
        grid.baseChars[i] = cp;
        grid.twPhase[i] = Math.random() * Math.PI * 2;
        grid.twSpeed[i] = 0.15 + Math.random() * 0.35;
      }
    }

    rasterizeHitMask(values.maskText || "你好", grid.cols, grid.rows);
  }, [width, height, values.cellSize, values.fillMode, values.script, values.fixedText, values.maskText, rasterizeHitMask]);


  // Add active
  const addActive = useCallback((idx: number) => {
    const grid = gridRef.current;
    if (grid.activeFlag[idx]) return;
    grid.activeFlag[idx] = 1;
    grid.active.push(idx);
  }, []);

  // Step simulation
  const stepSimulation = useCallback(() => {
    const grid = gridRef.current;
    const outStrength = clamp(values.outsideStrength ?? 0.18, 0, 1);
    const inStrength = clamp(values.insideStrength ?? 1.0, 0, 1);
    const decayOut = clamp(values.outsideDecay ?? 0.72, 0.5, 0.98);
    const decayIn = clamp(values.insideDecay ?? 0.9, 0.5, 0.995);
    const isFixed = (values.fillMode || "random") === "fixed";

    // Decay active cells
    for (let i = 0; i < grid.active.length; ) {
      const idx = grid.active[i];
      const dec = grid.hitMask[idx] ? decayIn : decayOut;
      const v = grid.trail[idx] * dec;

      if (v < 0.006) {
        grid.trail[idx] = 0;
        grid.activeFlag[idx] = 0;

        if (isFixed && grid.wallChars[idx] !== grid.baseChars[idx]) {
          grid.wallChars[idx] = grid.baseChars[idx];
        }

        grid.active[i] = grid.active[grid.active.length - 1];
        grid.active.pop();
        continue;
      }

      grid.trail[idx] = v;
      i++;
    }

    // Drops
    for (let c = 0; c < grid.cols; c++) {
      const prev = grid.dropPos[c];
      const next = prev + grid.dropSpd[c];

      const r0 = Math.floor(prev);
      const r1 = Math.floor(next);

      for (let r = r0; r <= r1; r++) {
        if (r < 0 || r >= grid.rows) continue;

        const idx = r * grid.cols + c;

        const cp = replacementCodepoint();
        if (grid.wallChars[idx] !== cp) {
          grid.wallChars[idx] = cp;
        }

        const inj = grid.hitMask[idx] ? inStrength : outStrength;
        if (inj > grid.trail[idx]) grid.trail[idx] = inj;
        addActive(idx);
      }

      grid.dropPos[c] = next;

      if (grid.dropPos[c] > grid.rows + 6) {
        if (Math.random() > 0.92) {
          grid.dropPos[c] = -Math.random() * 8;
          grid.dropSpd[c] = 0.6 + Math.random() * 1.4;
        }
      }
    }
  }, [
    values.outsideStrength,
    values.insideStrength,
    values.outsideDecay,
    values.insideDecay,
    values.fillMode,
    replacementCodepoint,
    addActive,
  ]);

  // Render
  const render = useCallback(
    (nowMs: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const grid = gridRef.current;

      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const fontPx = Math.max(6, grid.cell - 4);
      const monoFont = `${fontPx}px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Noto Sans Mono",monospace`;
      const serifFont = `700 ${fontPx}px "Times New Roman","Georgia","Times",serif`;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const wallB = clamp(values.wallBrightness ?? 0.25, 0, 0.6);
      const lift = clamp(values.wallLift ?? 0.05, 0, 0.2);
      const time = nowMs * 0.001;

      // PASS 1: Base wall with twinkle (monospace)
      ctx.font = monoFont;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      for (let r = 0; r < grid.rows; r++) {
        const y = grid.yCenter[r];
        if (y < -grid.cell || y > height + grid.cell) continue;
        for (let c = 0; c < grid.cols; c++) {
          const x = grid.xCenter[c];
          if (x < -grid.cell || x > width + grid.cell) continue;
          const i = r * grid.cols + c;
          const tw = 0.86 + 0.14 * Math.sin(grid.twPhase[i] + time * grid.twSpeed[i]);
          const a = wallB * tw;
          ctx.fillStyle = hexToRgba(colors.outsideTrail, a);
          ctx.fillText(glyph(grid.wallChars[i]), x, y);
        }
      }

      // PASS 2: Wall lift (monospace, on active cells)
      if (lift > 0.0005) {
        ctx.font = monoFont;
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#fff";

        for (let i = 0; i < grid.active.length; i++) {
          const idx = grid.active[i];
          const v = grid.trail[idx];
          const a = Math.min(lift, lift * (0.4 + 0.6 * v));
          if (a <= 0.001) continue;

          const r = (idx / grid.cols) | 0;
          const c = idx - r * grid.cols;
          ctx.globalAlpha = a;
          ctx.fillText(glyph(grid.wallChars[idx]), grid.xCenter[c], grid.yCenter[r]);
        }
        ctx.globalAlpha = 1;
      }

      // PASS 3: Trails (monospace)
      const outsideColor = hexToRgba(colors.outsideTrail, 1);
      const insideColor = colors.accent;

      // Outside trails
      ctx.font = monoFont;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      for (let i = 0; i < grid.active.length; i++) {
        const idx = grid.active[i];
        if (grid.hitMask[idx]) continue;

        const v = grid.trail[idx];
        const a = Math.min(0.28, v * 0.35);
        if (a <= 0.001) continue;

        const r = (idx / grid.cols) | 0;
        const c = idx - r * grid.cols;
        ctx.globalAlpha = a;
        ctx.fillStyle = outsideColor;
        ctx.fillText(glyph(grid.wallChars[idx]), grid.xCenter[c], grid.yCenter[r]);
      }

      // Inside trails with glow
      const glow = clamp(values.glowRadius ?? 14, 0, 30);
      ctx.shadowBlur = glow;
      ctx.shadowColor = insideColor;

      for (let i = 0; i < grid.active.length; i++) {
        const idx = grid.active[i];
        if (!grid.hitMask[idx]) continue;

        const v = grid.trail[idx];
        const a = Math.min(1, v);
        if (a <= 0.001) continue;

        const r = (idx / grid.cols) | 0;
        const c = idx - r * grid.cols;
        ctx.globalAlpha = a;
        ctx.fillStyle = insideColor;
        ctx.fillText(glyph(grid.wallChars[idx]), grid.xCenter[c], grid.yCenter[r]);
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // PASS 4: Highlight overlay (serif)
      const op = clamp(values.wordOpacity ?? 0.6, 0, 1);
      if (op > 0.001) {
        ctx.font = values.wordFont === "serif" ? serifFont : monoFont;
        ctx.fillStyle = `rgba(255,255,255,${op.toFixed(4)})`;

        for (let c = 0; c < grid.cols; c++) {
          const idxs = grid.hiByCol[c];
          if (!idxs || idxs.length === 0) continue;
          const x = grid.xCenter[c];
          for (let k = 0; k < idxs.length; k++) {
            const idx = idxs[k];
            const r = (idx / grid.cols) | 0;
            ctx.fillText(glyph(grid.wallChars[idx]), x, grid.yCenter[r]);
          }
        }
      }
    },
    [
      width,
      height,
      values.wallBrightness,
      values.wallLift,
      values.glowRadius,
      values.wordOpacity,
      values.wordFont,
      colors,
      glyph,
    ]
  );

  // EFFECT 1: Rebuild on GEOMETRY changes only
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;

    rebuildAll();
  }, [width, height, values.cellSize, values.fillMode, values.script, values.fixedText, rebuildAll]);

  // EFFECT 2: Rasterize mask on text change (no rebuild needed!)
  useEffect(() => {
    const grid = gridRef.current;
    if (grid.cols > 1) {
      rasterizeHitMask(values.maskText || "你好", grid.cols, grid.rows);
    }
  }, [values.maskText, rasterizeHitMask]);

  // EFFECT 3: Main animation loop
  useEffect(() => {
    if (isPaused) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const MAX_STEPS_PER_FRAME = 3;
    const loop = (nowMs: number) => {
      nowMs = nowMs || performance.now();
      if (!lastRef.current) lastRef.current = nowMs;
      const dt = Math.min(50, nowMs - lastRef.current);
      lastRef.current = nowMs;

      const stepsPerSec = clamp(values.rainSpeed ?? 12, 1, 120);
      const stepMs = 1000 / stepsPerSec;

      accRef.current += dt;
      let steps = 0;
      while (accRef.current >= stepMs && steps < MAX_STEPS_PER_FRAME) {
        stepSimulation();
        accRef.current -= stepMs;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) {
        accRef.current = 0;
      }

      render(nowMs);
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPaused, values.rainSpeed, stepSimulation, render]);

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
