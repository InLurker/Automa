import { Label } from "@/components/ui/label";
import type { Parameter } from "@/types/automa";

interface ControlColorProps {
  parameter: Parameter;
  value: string;
  onChange: (value: string) => void;
}

export function ControlColor({ parameter, value, onChange }: ControlColorProps) {
  const { label } = parameter;

  return (
    <div className="space-y-2">
      <Label htmlFor={parameter.key} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={parameter.key}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-16 rounded border border-input bg-background cursor-pointer"
        />
        <span className="text-sm text-muted-foreground font-mono">{value}</span>
      </div>
    </div>
  );
}
