import { useState, useRef, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import type { Parameter } from "@/types/automa";

interface GradientStop {
  p: number; // position 0-1
  v: number; // value 0-1
}

interface ControlGradientProps {
  parameter: Parameter;
  value: string; // JSON string
  onChange: (value: string) => void;
  inlineToggleValue?: boolean;
  onInlineToggleChange?: (value: boolean) => void;
}

export function ControlGradient({ 
  parameter, 
  value, 
  onChange,
  inlineToggleValue,
  onInlineToggleChange
}: ControlGradientProps) {
  const [stops, setStops] = useState<GradientStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<GradientStop | null>(null);
  const [dragging, setDragging] = useState<{
    stop: GradientStop;
    pointerId: number;
    rectLeft: number;
    rectW: number;
  } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Parse value on mount and when it changes
  useEffect(() => {
    try {
      if (value && typeof value === "string") {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setStops(parsed);
          return;
        }
      }
    } catch {}

    // Default gradient
    setStops([
      { p: 0.0, v: 0.0 },
      { p: 0.2, v: 0.1 },
      { p: 0.5, v: 0.8 },
      { p: 0.8, v: 0.1 },
      { p: 1.0, v: 0.0 },
    ]);
  }, [value]);

  const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

  const sortStops = (s: GradientStop[]) => s.sort((a, b) => a.p - b.p);

  const updateValue = (newStops: GradientStop[]) => {
    const sorted = sortStops([...newStops]);
    setStops(sorted);
    onChange(JSON.stringify(sorted.map((s) => ({ p: +s.p.toFixed(4), v: +s.v.toFixed(4) }))));
  };

  const cssGradient = () => {
    const sorted = sortStops([...stops]);
    const parts = sorted.map((s) => `rgba(255,255,255,${clamp(s.v, 0, 1)}) ${Math.round(s.p * 100)}%`);
    return `linear-gradient(90deg, ${parts.join(", ")})`;
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== barRef.current) return;
    const rect = barRef.current!.getBoundingClientRect();
    const p = clamp((e.clientX - rect.left) / rect.width, 0, 1);

    // Calculate value at position
    const sorted = sortStops([...stops]);
    let v = 0;
    if (p <= sorted[0].p) v = sorted[0].v;
    else if (p >= sorted[sorted.length - 1].p) v = sorted[sorted.length - 1].v;
    else {
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i],
          b = sorted[i + 1];
        if (p >= a.p && p <= b.p) {
          const t = (p - a.p) / Math.max(1e-6, b.p - a.p);
          v = a.v + (b.v - a.v) * t;
          break;
        }
      }
    }

    const newStop = { p, v };
    const newStops = [...stops, newStop];
    updateValue(newStops);
    setSelectedStop(newStop);
  };

  const handleStopPointerDown = (e: React.PointerEvent, stop: GradientStop) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedStop(stop);
    const rect = barRef.current!.getBoundingClientRect();
    setDragging({
      stop,
      pointerId: e.pointerId,
      rectLeft: rect.left,
      rectW: rect.width,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    e.preventDefault();

    dragging.stop.p = clamp((e.clientX - dragging.rectLeft) / dragging.rectW, 0, 1);

    // Enforce ordering
    const sorted = sortStops([...stops]);
    const idx = sorted.indexOf(dragging.stop);
    if (idx > 0) dragging.stop.p = Math.max(dragging.stop.p, sorted[idx - 1].p + 0.001);
    if (idx < sorted.length - 1) dragging.stop.p = Math.min(dragging.stop.p, sorted[idx + 1].p - 0.001);
    dragging.stop.p = clamp(dragging.stop.p, 0, 1);

    setStops([...stops]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    setDragging(null);
    updateValue(stops);
  };

  const handlePosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedStop) return;
    selectedStop.p = clamp(Number(e.target.value) || 0, 0, 1);
    const newStops = sortStops([...stops]);
    updateValue(newStops);
  };

  const handleValChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedStop) return;
    selectedStop.v = clamp(Number(e.target.value) || 0, 0, 1);
    setStops([...stops]);
    updateValue(stops);
  };

  const deleteStop = () => {
    if (!selectedStop || stops.length <= 2) return;
    const idx = stops.indexOf(selectedStop);
    if (idx >= 0) {
      const newStops = stops.filter((s) => s !== selectedStop);
      setSelectedStop(newStops[Math.max(0, idx - 1)] || newStops[0] || null);
      updateValue(newStops);
    }
  };

  const applyPreset = (preset: "soft" | "sharp") => {
    const newStops =
      preset === "soft"
        ? [
            { p: 0.0, v: 0.0 },
            { p: 0.15, v: 0.1 },
            { p: 0.5, v: 0.8 },
            { p: 0.85, v: 0.1 },
            { p: 1.0, v: 0.0 },
          ]
        : [
            { p: 0.0, v: 0.0 },
            { p: 0.5, v: 1.0 },
            { p: 1.0, v: 0.0 },
          ];
    updateValue(newStops);
    setSelectedStop(newStops[Math.floor(newStops.length / 2)]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground/90 flex-1">{parameter.label}</label>
        
        {parameter.inlineToggle && onInlineToggleChange !== undefined && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wider whitespace-nowrap">
              {parameter.inlineToggle.label}
            </span>
            <Switch
              checked={inlineToggleValue}
              onCheckedChange={onInlineToggleChange}
            />
          </div>
        )}
        
        {!parameter.inlineToggle && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => applyPreset("soft")}
              className="text-[10px] px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              Soft
            </button>
            <button
              type="button"
              onClick={() => applyPreset("sharp")}
              className="text-[10px] px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              Sharp
            </button>
          </div>
        )}
      </div>
      
      {parameter.inlineToggle && (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => applyPreset("soft")}
            className="text-[10px] px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Soft
          </button>
          <button
            type="button"
            onClick={() => applyPreset("sharp")}
            className="text-[10px] px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Sharp
          </button>
        </div>
      )}

      {/* Gradient bar */}
      <div
        ref={barRef}
        onClick={handleBarClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragging(null)}
        className="relative h-9 rounded-lg border border-border/40 overflow-hidden cursor-pointer select-none touch-none"
        style={{ background: cssGradient() }}
      >
        {stops.map((stop, i) => (
          <div
            key={i}
            onPointerDown={(e) => handleStopPointerDown(e, stop)}
            className={`absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm border cursor-move ${
              stop === selectedStop
                ? "border-foreground bg-background shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                : "border-border bg-background/90"
            }`}
            style={{ left: `${(stop.p * 100).toFixed(3)}%` }}
          >
            <div
              className="absolute inset-0.5 rounded-[1px]"
              style={{ background: `rgba(255,255,255,${clamp(stop.v, 0, 1)})` }}
            />
          </div>
        ))}
      </div>

      {/* Stop controls */}
      {selectedStop && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Position</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={selectedStop.p.toFixed(2)}
              onChange={handlePosChange}
              className="w-full px-2 py-1.5 text-xs rounded bg-background border border-border/40 text-foreground focus:border-border focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Value</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={selectedStop.v.toFixed(2)}
              onChange={handleValChange}
              className="w-full px-2 py-1.5 text-xs rounded bg-background border border-border/40 text-foreground focus:border-border focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Delete button */}
      {selectedStop && stops.length > 2 && (
        <button
          type="button"
          onClick={deleteStop}
          className="w-full text-xs px-3 py-1.5 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
        >
          Delete Stop
        </button>
      )}

      <p className="text-[10px] text-muted-foreground">
        Click bar to add • Drag stops to reposition • Select to edit
      </p>
    </div>
  );
}
