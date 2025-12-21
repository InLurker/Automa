import { useState } from "react";
import type { ParameterGroup } from "@/types/automa";

interface ControlSectionProps {
  title: ParameterGroup;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ControlSection({ title, children, defaultOpen = true }: ControlSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-sm font-semibold 
                   text-foreground/90 hover:text-foreground transition-colors
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 
                   focus-visible:ring-offset-2 focus-visible:ring-offset-background
                   rounded-sm"
      >
        <span className="tracking-wide uppercase text-xs">{title}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-6 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
