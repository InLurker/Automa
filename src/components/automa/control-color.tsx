import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Parameter } from "@/types/automa";

interface ControlColorProps {
  parameter: Parameter;
  value: string;
  onChange: (value: string) => void;
  inlineToggleValue?: boolean;
  onInlineToggleChange?: (value: boolean) => void;
  secondaryToggleValue?: boolean;
  onSecondaryToggleChange?: (value: boolean) => void;
  allValues?: Record<string, any>;
}

export function ControlColor({ 
  parameter, 
  value, 
  onChange,
  inlineToggleValue,
  onInlineToggleChange,
  secondaryToggleValue,
  onSecondaryToggleChange,
  allValues
}: ControlColorProps) {
  const { label, inlineToggle, secondaryToggle } = parameter;

  // For "Static" toggle, invert the logic (Static ON = keepColor OFF)
  const isInverted = inlineToggle?.label === "Static";
  const displayToggleValue = isInverted ? !inlineToggleValue : inlineToggleValue;
  const handleToggleChange = (checked: boolean) => {
    if (onInlineToggleChange) {
      onInlineToggleChange(isInverted ? !checked : checked);
    }
  };

  // Only show color picker when Static toggle is ON (or no toggle present)
  const shouldShowColorPicker = !inlineToggle || displayToggleValue;

  // Check if secondary toggle should be visible
  const shouldShowSecondaryToggle = secondaryToggle && 
    onSecondaryToggleChange !== undefined &&
    shouldShowColorPicker && // Only show when color picker is visible
    (!secondaryToggle.visibleWhen || 
     (allValues && allValues[secondaryToggle.visibleWhen.key] === secondaryToggle.visibleWhen.value));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={parameter.key} className="text-sm font-medium">
          {label}
        </Label>
        {inlineToggle && onInlineToggleChange !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {inlineToggle.label}
            </span>
            <Switch
              checked={displayToggleValue || false}
              onCheckedChange={handleToggleChange}
            />
          </div>
        )}
      </div>
      {shouldShowColorPicker && (
        <>
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
          {shouldShowSecondaryToggle && (
            <div className="flex items-center justify-between pl-1 py-1">
              <span className="text-xs text-muted-foreground">
                {secondaryToggle.label}
              </span>
              <Switch
                checked={secondaryToggleValue || false}
                onCheckedChange={onSecondaryToggleChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
