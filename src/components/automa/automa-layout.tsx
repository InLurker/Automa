import { useEffect, useRef, useState } from "react";
import type { AutomaRegistry } from "@/types/automa";
import { ControlsPanel } from "./controls-panel";
import { AutomaViewer } from "./automa-viewer";
import { AutomaComponentViewer } from "./automa-component-viewer";

interface AutomaLayoutProps {
  automa: AutomaRegistry;
}

export function AutomaLayout({ automa }: AutomaLayoutProps) {
  const [values, setValues] = useState(automa.defaults);
  const [isLive, setIsLive] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [animationPaused, setAnimationPaused] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  const handleValuesChange = (newValues: Record<string, any>, live: boolean) => {
    setValues(newValues);
    setIsLive(live);
  };

  const pauseAroundToggle = (next: boolean) => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    setAnimationPaused(true);
    setShowControls(next);
    pauseTimeoutRef.current = setTimeout(() => {
      setAnimationPaused(false);
    }, 400);
  };

  return (
    <div className="relative flex flex-1 w-full overflow-hidden bg-background text-foreground">
      {showControls && (
        <aside className="relative w-[360px] h-full border-r border-border/30 bg-background/85 backdrop-blur flex flex-col">
          <div className="flex-shrink-0 px-6 py-5 border-b border-border/30">
            <div className="space-y-1 pr-9">
              <h2 className="text-base font-semibold tracking-tight text-foreground">{automa.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{automa.description}</p>
            </div>
            <button
              onClick={() => pauseAroundToggle(false)}
              className="absolute top-4 right-4 inline-flex items-center justify-center rounded-full border border-border/40 bg-background/80 text-foreground/80 hover:text-foreground hover:border-border px-2 py-2 transition-colors"
              aria-label="Hide controls"
            >
              <span className="material-symbols-outlined text-base leading-none">
                collapse_content
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ControlsPanel automa={automa} values={values} onValuesChange={handleValuesChange} />
          </div>
        </aside>
      )}

      <section className="flex-1 w-full h-full bg-background">
        <div className="w-full h-full overflow-hidden">
        {automa.renderer.type === "component" ? (
          <AutomaComponentViewer automa={automa} values={values} isPaused={animationPaused} />
        ) : (
          <AutomaViewer automa={automa} values={values} isLive={isLive} isPaused={animationPaused} />
        )}
        </div>
      </section>

      {!showControls && (
        <div className="absolute z-20 top-6 left-6 max-w-sm w-full rounded-2xl border border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/5 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.35)] p-4 pr-12 transition-colors">
          <div className="space-y-1 overflow-hidden">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {automa.title}
            </p>
            <p
              className="text-xs text-muted-foreground leading-relaxed overflow-hidden"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              {automa.description}
            </p>
          </div>
          <button
            onClick={() => pauseAroundToggle(true)}
            className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors px-3 py-3 shadow-md"
            aria-label="Show controls"
          >
            <span className="material-symbols-outlined text-base leading-none">
              expand_content
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
