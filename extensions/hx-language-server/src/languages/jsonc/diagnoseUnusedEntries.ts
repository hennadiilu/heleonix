import { ReferenceType } from "@heleonix/hx-language"
import { IJsoncEntry } from "@heleonix/hx-compiler-core"
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { makeDiagnostic } from "../../lsp/makeDiagnostic"
import { REFERENCE_MESSAGES } from "../../references/referenceMessages"
import { definitionName } from "./definitionName"

export function diagnoseUnusedEntries(
  doc: TextDocument,
  kind: ReferenceType,
  entries: readonly IJsoncEntry[],
  bodyStart: number,
  index: DefinitionIndex,
  severity: DiagnosticSeverity | undefined,
  out: Diagnostic[],
): void {
  if (severity === undefined) {
    return
  }

  const name = definitionName(doc.uri)

  for (const entry of entries) {
    if (!index.isEntryUsed(kind, name, entry.key)) {
      out.push(
        makeDiagnostic(
          doc,
          bodyStart + entry.keyStart,
          bodyStart + entry.keyEnd,
          REFERENCE_MESSAGES.unusedEntry(kind, name, entry.key),
          severity,
        ),
      )
    }
  }
}
