import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Parameter } from "@/types/automa";

interface ControlNumberProps {
  parameter: Parameter;
  value: number;
  onChange: (value: number) => void;
}

export function ControlNumber({ parameter, value, onChange }: ControlNumberProps) {
  const { label, min, max, step = 1, unit = "" } = parameter;

  return (
    <div className="space-y-3">
      <Label htmlFor={parameter.key} className="text-sm font-medium text-foreground/90">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={parameter.key}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-9 bg-muted/30 border-border/50 focus:border-foreground/20 
                     focus:ring-foreground/20 transition-colors"
        />
        {unit && <span className="text-xs text-muted-foreground font-mono">{unit}</span>}
      </div>
    </div>
  );
}
