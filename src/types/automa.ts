// Automa type definitions

export type AutomaTheme = "Flow" | "Structure" | "Rhythm" | "Typography";

export type ParameterType = "slider" | "number" | "select" | "toggle" | "text" | "color" | "gradient" | "text-array" | "media";

export type ParameterGroup = "Motion" | "Geometry" | "Appearance" | "Timing";

export interface ParameterOption {
  label: string;
  value: string | number;
}

export interface Parameter {
  key: string;
  label: string;
  type: ParameterType;
  group: ParameterGroup;
  live: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: ParameterOption[];
  placeholder?: string;
  unit?: string;
  visibleWhen?: {
    key: string;
    value: any;
  };
  inlineToggle?: {
    key: string;
    label: string;
  };
}

export interface AutomaRegistry {
  id: string;
  slug: string;
  title: string;
  theme: AutomaTheme;
  description: string;
  schema: Parameter[];
  defaults: Record<string, any>;
  renderer: {
    type: "iframe" | "component";
    path?: string; // For iframe type
    component?: string; // Component name for dynamic import
  };
}

// Props that every automa component receives
export interface AutomaComponentProps {
  values: Record<string, any>;
  width: number;
  height: number;
  isPaused?: boolean;
  onChange?: (newValues: Record<string, any>) => void;
}

// Message protocol types
export type AutomaMessageFromParent =
  | { type: "automa:init"; payload: { values: Record<string, any> } }
  | { type: "automa:update"; payload: { partialValues: Record<string, any> } }
  | { type: "automa:rebuild"; payload: { values: Record<string, any> } };

export type AutomaMessageFromChild =
  | { type: "automa:ready" }
  | { type: "automa:telemetry"; payload: { fps: number } };
