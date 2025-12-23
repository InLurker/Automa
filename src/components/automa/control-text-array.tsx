import { Label } from "@/components/ui/label";
import type { Parameter } from "@/types/automa";
import { useState } from "react";

interface ControlTextArrayProps {
  parameter: Parameter;
  value: string[];
  onChange: (value: string[]) => void;
}

export function ControlTextArray({
  parameter,
  value,
  onChange,
}: ControlTextArrayProps) {
  const { label, placeholder = "" } = parameter;
  const texts = Array.isArray(value) && value.length > 0 ? value : [""];

  const handleTextChange = (index: number, newText: string) => {
    const updated = [...texts];
    updated[index] = newText;
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([...texts, ""]);
  };

  const handleRemove = (index: number) => {
    if (texts.length === 1) return; // Keep at least one
    const updated = texts.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-foreground/90">{label}</Label>

      <div className="space-y-2">
        {texts.map((text, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => handleTextChange(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-9 px-3 rounded-md border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            />
            {texts.length > 1 && (
              <button
                onClick={() => handleRemove(index)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border/40 bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                aria-label="Remove text"
              >
                <span className="text-lg leading-none">−</span>
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleAdd}
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-border/40 bg-background hover:bg-muted text-sm text-foreground/80 hover:text-foreground transition-colors"
      >
        <span className="text-base leading-none">+</span>
        <span>Add Text</span>
      </button>
    </div>
  );
}
