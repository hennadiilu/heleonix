import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { FlatObjectIssueKind, IJsoncEntry, parseJsonc } from "@heleonix/hx-compiler-core"
import { scanInterpolations } from "../../references/scanInterpolations"
import { scanParameters } from "../../references/scanParameters"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { makeDiagnostic } from "../../lsp/makeDiagnostic"
import { referenceIssue } from "../../references/resolveReference"
import { diagnoseDataEnvelope } from "../jsonc/diagnoseDataEnvelope"
import { definitionName } from "../jsonc/definitionName"
import { diagnoseUnusedEntries } from "../jsonc/diagnoseUnusedEntries"
import { DICTIONARY_MESSAGES } from "./dictionaryMessages"
import { parameterIssue } from "./resolveParameter"

export function diagnoseDictionary(
  doc: TextDocument,
  index: DefinitionIndex,
  refSeverity: DiagnosticSeverity | undefined,
  unusedSeverity: DiagnosticSeverity | undefined,
): Diagnostic[] {
  const envelope = diagnoseDataEnvelope(doc)
  const diagnostics = envelope.diagnostics

  if (envelope.parseOk && envelope.body !== undefined) {
    const { issues, entries } = parseJsonc(envelope.body)

    for (const issue of issues) {
      diagnostics.push(
        makeDiagnostic(
          doc,
          envelope.bodyStart + issue.start,
          envelope.bodyStart + issue.end,
          flatMessage(issue.kind),
          DiagnosticSeverity.Error,
        ),
      )
    }

    if (refSeverity !== undefined) {
      diagnoseParameters(doc, envelope.body, envelope.bodyStart, entries, index, refSeverity, diagnostics)
    }

    diagnoseUnusedEntries(doc, "dictionary", entries, envelope.bodyStart, index, unusedSeverity, diagnostics)
  }

  if (refSeverity !== undefined) {
    // Dictionaries reference other dictionaries (`{@Name.entry}`), never configs.
    for (const ref of scanInterpolations(doc.getText())) {
      if (ref.kind !== "dictionary") {
        continue
      }

      const message = referenceIssue("dictionary", ref.name ?? "", ref.entry ?? "", index)

      if (message) {
        diagnostics.push(makeDiagnostic(doc, ref.start, ref.end, message, refSeverity))
      }
    }
  }

  return diagnostics
}

function diagnoseParameters(
  doc: TextDocument,
  body: string,
  bodyStart: number,
  entries: readonly IJsoncEntry[],
  index: DefinitionIndex,
  severity: DiagnosticSeverity,
  out: Diagnostic[],
): void {
  const dictName = definitionName(doc.uri)

  for (const entry of entries) {
    // `{@..}` / `{#..}` are references, handled separately; scanParameters keeps
    // only the state params.
    for (const param of scanParameters(body.slice(entry.valueStart, entry.valueEnd))) {
      const message = parameterIssue(dictName, entry.key, param.name, index)

      if (message) {
        const start = bodyStart + entry.valueStart
        out.push(makeDiagnostic(doc, start + param.start, start + param.end, message, severity))
      }
    }
  }
}

function flatMessage(kind: FlatObjectIssueKind): string {
  if (kind === "notObject") {
    return DICTIONARY_MESSAGES.notObject
  }

  if (kind === "nested") {
    return DICTIONARY_MESSAGES.nested
  }

  return DICTIONARY_MESSAGES.nonString
}
