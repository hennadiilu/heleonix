import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

const DIAGNOSTIC_SOURCE = "heleonix"

export function makeDiagnostic(
  doc: TextDocument,
  start: number,
  end: number,
  message: string,
  severity: DiagnosticSeverity,
): Diagnostic {
  return {
    severity,
    range: Range.create(doc.positionAt(start), doc.positionAt(Math.max(end, start + 1))),
    message,
    source: DIAGNOSTIC_SOURCE,
  }
}
