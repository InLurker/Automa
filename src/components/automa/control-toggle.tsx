import { Label } from "@/components/ui/label";
import type { Parameter } from "@/types/automa";

interface ControlToggleProps {
  parameter: Parameter;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ControlToggle({ parameter, value, onChange }: ControlToggleProps) {
  const { label } = parameter;

  return (
    <div className="flex items-center justify-between py-1">
      <Label htmlFor={parameter.key} className="text-sm font-medium text-foreground/90">
        {label}
      </Label>
      <button
        id={parameter.key}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
          ${value ? "bg-foreground" : "bg-muted/50"}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-background shadow-sm
            transition-transform duration-200
            ${value ? "translate-x-6" : "translate-x-1"}
          `}
        />
      </button>
    </div>
  );
}
