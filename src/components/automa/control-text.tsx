import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Parameter } from "@/types/automa";

interface ControlTextProps {
  parameter: Parameter;
  value: string;
  onChange: (value: string) => void;
}

export function ControlText({ parameter, value, onChange }: ControlTextProps) {
  const { label, placeholder = "" } = parameter;

  return (
    <div className="space-y-2">
      <Label htmlFor={parameter.key} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={parameter.key}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}
