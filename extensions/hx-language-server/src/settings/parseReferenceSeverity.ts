import { DiagnosticSeverity } from "vscode-languageserver"

/** Parses a severity setting (`error`/`warning`/`information`/`hint`) to an LSP severity (`undefined` = off). */
export function parseReferenceSeverity(value: string | undefined): DiagnosticSeverity | undefined {
  if (value === "error") {
    return DiagnosticSeverity.Error
  }

  if (value === "warning") {
    return DiagnosticSeverity.Warning
  }

  if (value === "information") {
    return DiagnosticSeverity.Information
  }

  if (value === "hint") {
    return DiagnosticSeverity.Hint
  }

  return undefined
}
