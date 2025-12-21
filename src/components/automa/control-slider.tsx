import { Label } from "@/components/ui/label";
import type { Parameter } from "@/types/automa";

interface ControlSliderProps {
  parameter: Parameter;
  value: number;
  onChange: (value: number) => void;
}

export function ControlSlider({ parameter, value, onChange }: ControlSliderProps) {
  const { label, min = 0, max = 100, step = 1, unit = "" } = parameter;
  
  // Calculate percentage for visual feedback
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={parameter.key} className="text-sm font-medium text-foreground/90">
          {label}
        </Label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit && <span className="ml-0.5">{unit}</span>}
        </span>
      </div>
      <div className="relative">
        <input
          id={parameter.key}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-muted/50 rounded-full appearance-none cursor-pointer 
                     transition-all
                     [&::-webkit-slider-thumb]:appearance-none 
                     [&::-webkit-slider-thumb]:w-4 
                     [&::-webkit-slider-thumb]:h-4 
                     [&::-webkit-slider-thumb]:rounded-full 
                     [&::-webkit-slider-thumb]:bg-foreground 
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:shadow-sm
                     [&::-webkit-slider-thumb]:transition-all
                     [&::-webkit-slider-thumb]:hover:scale-110
                     [&::-webkit-slider-thumb]:hover:shadow-md
                     [&::-moz-range-thumb]:w-4 
                     [&::-moz-range-thumb]:h-4 
                     [&::-moz-range-thumb]:rounded-full 
                     [&::-moz-range-thumb]:bg-foreground 
                     [&::-moz-range-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:border-0
                     [&::-moz-range-thumb]:shadow-sm
                     [&::-moz-range-thumb]:transition-all
                     focus:outline-none 
                     focus-visible:ring-2 
                     focus-visible:ring-foreground/20 
                     focus-visible:ring-offset-2
                     focus-visible:ring-offset-background"
          style={{
            background: `linear-gradient(to right, hsl(var(--foreground) / 0.15) 0%, hsl(var(--foreground) / 0.15) ${percentage}%, hsl(var(--muted) / 0.5) ${percentage}%, hsl(var(--muted) / 0.5) 100%)`
          }}
        />
      </div>
    </div>
  );
}
