import { Label } from "@/components/ui/label";
import type { Parameter } from "@/types/automa";

interface ControlSelectProps {
  parameter: Parameter;
  value: string | number;
  onChange: (value: string | number) => void;
}

export function ControlSelect({ parameter, value, onChange }: ControlSelectProps) {
  const { label, options = [] } = parameter;

  return (
    <div className="space-y-3">
      <Label htmlFor={parameter.key} className="text-sm font-medium text-foreground/90">
        {label}
      </Label>
      <select
        id={parameter.key}
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          // Try to parse as number if it looks like one
          const numVal = parseFloat(val);
          onChange(isNaN(numVal) ? val : numVal);
        }}
        className="flex h-9 w-full rounded-md border border-border/50 
                   bg-muted/30 px-3 py-1 text-sm shadow-sm transition-colors
                   focus-visible:outline-none focus-visible:ring-2 
                   focus-visible:ring-foreground/20 focus-visible:border-foreground/20
                   disabled:cursor-not-allowed disabled:opacity-50
                   hover:border-foreground/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
