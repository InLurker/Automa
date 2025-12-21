import { useState } from "react";
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

  const handleValuesChange = (newValues: Record<string, any>, live: boolean) => {
    setValues(newValues);
    setIsLive(live);
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-background text-foreground">
      {showControls && (
        <aside className="w-[320px] border-r border-border/30 bg-background/80 backdrop-blur-sm flex flex-col">
          <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Control
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">{automa.theme}</p>
            </div>
            <button
              onClick={() => setShowControls(false)}
              className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Hide
            </button>
          </div>
          <ControlsPanel automa={automa} onValuesChange={handleValuesChange} />
        </aside>
      )}

      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="absolute z-10 top-24 left-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border/40 bg-background/90 backdrop-blur"
        >
          Show Controls
        </button>
      )}

      <section className="flex-1 flex flex-col bg-background">
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Animation
          </p>
          <span className="text-xs text-muted-foreground/80">{automa.title}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {automa.renderer.type === "component" ? (
            <AutomaComponentViewer automa={automa} values={values} />
          ) : (
            <AutomaViewer automa={automa} values={values} isLive={isLive} />
          )}
        </div>
      </section>
    </div>
  );
}
