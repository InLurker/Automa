import { useState } from "react";
import type { AutomaRegistry, Parameter, ParameterGroup } from "@/types/automa";
import { ControlSlider } from "./control-slider";
import { ControlNumber } from "./control-number";
import { ControlToggle } from "./control-toggle";
import { ControlSelect } from "./control-select";
import { ControlText } from "./control-text";
import { ControlColor } from "./control-color";
import { ControlGradient } from "./control-gradient";
import { ControlSection } from "./control-section";

interface ControlsPanelProps {
  automa: AutomaRegistry;
  onValuesChange: (values: Record<string, any>, isLive: boolean) => void;
}

export function ControlsPanel({ automa, onValuesChange }: ControlsPanelProps) {
  const [values, setValues] = useState<Record<string, any>>(automa.defaults);

  // Group parameters by their group
  const groupedParams = automa.schema.reduce((acc, param) => {
    if (!acc[param.group]) {
      acc[param.group] = [];
    }
    acc[param.group].push(param);
    return acc;
  }, {} as Record<ParameterGroup, Parameter[]>);

  const handleChange = (key: string, value: any, live: boolean) => {
    const newValues = { ...values, [key]: value };
    setValues(newValues);
    onValuesChange(newValues, live);
  };

  const renderControl = (param: Parameter, skipIfInline = false) => {
    // Check visibility condition
    if (param.visibleWhen) {
      const conditionValue = values[param.visibleWhen.key];
      if (conditionValue !== param.visibleWhen.value) {
        return null;
      }
    }

    // Skip if this is a toggle that's inline with another control
    if (skipIfInline && param.type === "toggle") {
      const parentControl = automa.schema.find(p => p.inlineToggle?.key === param.key);
      if (parentControl) {
        return null; // Will be rendered inline with parent
      }
    }

    const value = values[param.key];
    let control: React.ReactNode = null;

    switch (param.type) {
      case "slider":
        const inlineToggle = param.inlineToggle 
          ? automa.schema.find(p => p.key === param.inlineToggle?.key)
          : undefined;
        
        control = (
          <ControlSlider
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
            inlineToggleValue={inlineToggle ? values[inlineToggle.key] : undefined}
            onInlineToggleChange={inlineToggle 
              ? (v) => handleChange(inlineToggle.key, v, inlineToggle.live)
              : undefined
            }
          />
        );
        break;
      case "number":
        control = (
          <ControlNumber
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
          />
        );
        break;
      case "toggle":
        control = (
          <ControlToggle
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
          />
        );
        break;
      case "select":
        control = (
          <ControlSelect
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
          />
        );
        break;
      case "text":
        control = (
          <ControlText
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
          />
        );
        break;
      case "color":
        control = (
          <ControlColor
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
          />
        );
        break;
      case "gradient":
        const gradientInlineToggle = param.inlineToggle 
          ? automa.schema.find(p => p.key === param.inlineToggle?.key)
          : undefined;
        
        control = (
          <ControlGradient
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
            inlineToggleValue={gradientInlineToggle ? values[gradientInlineToggle.key] : undefined}
            onInlineToggleChange={gradientInlineToggle 
              ? (v) => handleChange(gradientInlineToggle.key, v, gradientInlineToggle.live)
              : undefined
            }
          />
        );
        break;
      default:
        control = null;
    }

    if (!control) return null;

    return (
      <div
        key={param.key}
        className="rounded-xl border border-border/40 bg-background/70 px-4 py-4 shadow-[0px_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-sm"
      >
        {control}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
      <div className="px-6 pt-4 pb-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Control
        </p>
      </div>

      <div className="px-6 pb-8 space-y-3">
        {(Object.keys(groupedParams) as ParameterGroup[]).map((group) => (
          <ControlSection key={group} title={group}>
            <div className="space-y-3">{groupedParams[group].map((param) => renderControl(param, true))}</div>
          </ControlSection>
        ))}
      </div>
    </div>
  );
}
