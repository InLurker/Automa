import { useState } from "react";
import type { AutomaRegistry, Parameter, ParameterGroup } from "@/types/automa";
import { ControlSlider } from "./control-slider";
import { ControlNumber } from "./control-number";
import { ControlToggle } from "./control-toggle";
import { ControlSelect } from "./control-select";
import { ControlText } from "./control-text";
import { ControlColor } from "./control-color";
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

  const renderControl = (param: Parameter) => {
    const value = values[param.key];
    let control: React.ReactNode = null;

    switch (param.type) {
      case "slider":
        control = (
          <ControlSlider
            parameter={param}
            value={value}
            onChange={(v) => handleChange(param.key, v, param.live)}
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
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
      <div className="px-6 pt-6 pb-4 border-b border-border/40">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground/70">
          {automa.theme}
        </p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {automa.description}
        </p>
      </div>

      <div className="p-6 space-y-3">
        {(Object.keys(groupedParams) as ParameterGroup[]).map((group) => (
          <ControlSection key={group} title={group}>
            <div className="space-y-3">{groupedParams[group].map((param) => renderControl(param))}</div>
          </ControlSection>
        ))}
      </div>
    </div>
  );
}
