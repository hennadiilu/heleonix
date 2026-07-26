import type { DiagnosticSeverity } from "./DiagnosticSeverity"

/**
 * The stable diagnostic catalog. Codes never change meaning; messages are
 * always present - the analyzer is tooling, never a runtime payload.
 * Reference resolution failures (00xx) are errors; contract violations (01xx)
 * are errors on declared facts.
 */
export const Diagnostics = {
  unknownComponent: {
    code: "HX_ANALYZER_0001",
    severity: "error" as DiagnosticSeverity,
    message: "Unknown component '<{0}>': no definition, builtin or dependency provides it.",
  },
  unknownDictionaryEntry: {
    code: "HX_ANALYZER_0002",
    severity: "error" as DiagnosticSeverity,
    message: "Unresolved dictionary reference '@{0}': no dictionary provides this entry.",
  },
  unknownConfigEntry: {
    code: "HX_ANALYZER_0003",
    severity: "error" as DiagnosticSeverity,
    message: "Unresolved config reference '#{0}': no config provides this entry.",
  },
  unknownThemeToken: {
    code: "HX_ANALYZER_0004",
    severity: "error" as DiagnosticSeverity,
    message: "Unresolved theme reference '{0}': no theme defines this token.",
  },
  themeAliasCycle: {
    code: "HX_ANALYZER_0005",
    severity: "error" as DiagnosticSeverity,
    message: "Theme token '{0}' is part of an alias cycle: '{$...}' references must resolve without cycles.",
  },
  unknownScopeSegment: {
    code: "HX_ANALYZER_0006",
    severity: "error" as DiagnosticSeverity,
    message: "Unknown scope segment '{0}' in '@hx-style(for: {1})': it names no child control or component type.",
  },
  unknownConverter: {
    code: "HX_ANALYZER_0009",
    severity: "error" as DiagnosticSeverity,
    message: "Unknown converter '{0}': no converter header declares it.",
  },
  unknownConverterArgument: {
    code: "HX_ANALYZER_0010",
    severity: "error" as DiagnosticSeverity,
    message: "Unknown argument '{0}' of converter '{1}'.",
  },
  missingConverterArgument: {
    code: "HX_ANALYZER_0011",
    severity: "error" as DiagnosticSeverity,
    message: "Missing required argument '{0}' of converter '{1}'.",
  },
  unknownOverrideComponent: {
    code: "HX_ANALYZER_0012",
    severity: "error" as DiagnosticSeverity,
    message: "Component override resolves to unknown component '{0}' (for target '{1}').",
  },
  missingBaseSuffix: {
    code: "HX_ANALYZER_0013",
    severity: "error" as DiagnosticSeverity,
    message: "Class '{0}' must end with '{1}' - its {1} binding name is derived from the class name.",
  },
  unknownAction: {
    code: "HX_ANALYZER_0014",
    severity: "error" as DiagnosticSeverity,
    message: "Unknown action '{0}': no action class declares it.",
  },
  unknownActionArgument: {
    code: "HX_ANALYZER_0015",
    severity: "error" as DiagnosticSeverity,
    message: "Unknown argument '{0}' of action '{1}'.",
  },
  missingActionArgument: {
    code: "HX_ANALYZER_0016",
    severity: "error" as DiagnosticSeverity,
    message: "Missing required argument '{0}' of action '{1}'.",
  },
  inOutNotWritable: {
    code: "HX_ANALYZER_0017",
    severity: "error" as DiagnosticSeverity,
    message: "In-out argument '{0}' of action '{1}' must bind a writable state path, not {2}.",
  },
  unresolvedPropsType: {
    code: "HX_ANALYZER_0100",
    severity: "error" as DiagnosticSeverity,
    message: "The props/events type of '<{0}>' cannot be resolved by TypeScript.",
  },
  functionProp: {
    code: "HX_ANALYZER_0101",
    severity: "error" as DiagnosticSeverity,
    message: "Prop '{0}' of '<{1}>' is a function; component props must be data - handle callbacks as events.",
  },
  propTypeMismatch: {
    code: "HX_ANALYZER_0102",
    severity: "error" as DiagnosticSeverity,
    message: "'{0}' is not an allowed value of '{1}' on {2} (expected one of: {3}).",
  },
  unknownProp: {
    code: "HX_ANALYZER_0103",
    severity: "error" as DiagnosticSeverity,
    message: "Property '{0}' is not declared by the props/events type of '<{1}>'.",
  },
  valueKindMismatch: {
    code: "HX_ANALYZER_0105",
    severity: "error" as DiagnosticSeverity,
    message: "{0} is not assignable to '{1}' on {2}: expected {3}, got {4}.",
  },
  unknownStateBinding: {
    code: "HX_ANALYZER_0104",
    severity: "warning" as DiagnosticSeverity,
    message:
      "State path '{0}' resolves to nothing: not declared, not bound at any usage of '{1}' and not written in its template.",
  },
} as const
