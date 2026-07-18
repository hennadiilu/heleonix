import { ReferenceType } from "@heleonix/hx-language"
import { IJsoncEntry } from "@heleonix/hx-compiler-core"
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { makeDiagnostic } from "../../lsp/makeDiagnostic"
import { REFERENCE_MESSAGES } from "../../references/referenceMessages"
import { definitionName } from "./definitionName"

/**
 * Flags every top-level entry of a `*.hxd`/`*.hxc` whose key is never referenced
 * (`@Name.entry` / `#Name.entry`) by any component - and, for dictionaries, by
 * any other dictionary. `severity` is `undefined` when the check is turned off.
 * `entries` and `bodyStart` come from the body parse so offsets land on the key.
 */
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
