import { DiagnosticSeverity } from "vscode-languageserver"
import type { DiagnosticLevel } from "@heleonix/hx-plugin-core"

const SEVERITIES: Record<Exclude<DiagnosticLevel, "off">, DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  information: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
}

/** The editor severity of a level; `undefined` for `off`. */
export function toDiagnosticSeverity(level: DiagnosticLevel): DiagnosticSeverity | undefined {
  return level === "off" ? undefined : SEVERITIES[level]
}
