import { useEffect, useRef, useState } from "react";
import type { AutomaRegistry } from "@/types/automa";
import { DriftAutoma } from "./renderers/drift";
import { LatticeAutoma } from "./renderers/lattice";
import { PulseAutoma } from "./renderers/pulse";
import { MatrixTrailsAutoma } from "./renderers/matrix-trails";
import { ShimmerWallAutoma } from "./renderers/shimmer-wall";
import { SweepHighlightAutoma } from "./renderers/sweep-highlight";

interface AutomaComponentViewerProps {
  automa: AutomaRegistry;
  values: Record<string, any>;
  isPaused?: boolean;
}

export function AutomaComponentViewer({ automa, values, isPaused = false }: AutomaComponentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        // Only update if we have valid dimensions
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };

    // Initial update with a small delay to ensure layout is complete
    const timer = setTimeout(updateDimensions, 100);

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, []);

  const renderAutoma = () => {
    if (dimensions.width === 0 || dimensions.height === 0) {
      return <div className="text-muted-foreground text-sm">Initializing...</div>;
    }

    const props = { values, ...dimensions, isPaused };

    switch (automa.renderer.component) {
      case "drift":
        return <DriftAutoma {...props} />;
      case "lattice":
        return <LatticeAutoma {...props} />;
      case "pulse":
        return <PulseAutoma {...props} />;
      case "matrix-trails":
        return <MatrixTrailsAutoma {...props} />;
      case "shimmer-wall":
        return <ShimmerWallAutoma {...props} />;
      case "sweep-highlight":
        return <SweepHighlightAutoma {...props} />;
      default:
        return <div className="text-muted-foreground">Unknown automa type</div>;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-background flex items-center justify-center"
    >
      {renderAutoma()}
      {isPaused && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Paused
        </div>
      )}
    </div>
  );
}
