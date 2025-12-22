import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Parameter } from "@/types/automa";

interface ControlToggleProps {
  parameter: Parameter;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ControlToggle({ parameter, value, onChange }: ControlToggleProps) {
  const { label } = parameter;

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={parameter.key} className="text-xs font-medium text-foreground/80 flex-1">
        {label}
      </Label>
      <Switch
        id={parameter.key}
        checked={value}
        onCheckedChange={onChange}
      />
    </div>
  );
}
