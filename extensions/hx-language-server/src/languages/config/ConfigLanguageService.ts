import {
  COMPONENT_PROPERTY_SEPARATOR,
  CONFIG_REF_PREFIX,
  DICTIONARY_REF_PREFIX,
  EXT_CONFIG,
  Kind,
  PROPERTY_NAME_SEGMENT_SEPARATOR,
} from "@heleonix/hx-language"
import { parseJsonc } from "@heleonix/hx-compiler-core"
import { CompletionItem, Diagnostic, Hover, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { ILanguageContext } from "../ILanguageContext"
import { ILanguageService } from "../ILanguageService"
import { referenceCompletion } from "../../references/referenceCompletion"
import { diagnoseDataEnvelope } from "../jsonc/diagnoseDataEnvelope"
import { diagnoseUnusedEntries } from "../jsonc/diagnoseUnusedEntries"
import { entryKeyCompletion } from "../jsonc/entryKeyCompletion"
import { entryKeyHover } from "../jsonc/entryKeyHover"
import { frontmatterCompletion } from "../jsonc/frontmatterCompletion"

/** Language service for `*.hxc` configs (full JSONC; no flatness or interpolation rules). */
export class ConfigLanguageService implements ILanguageService {
  public readonly kind: Kind = "config"

  public readonly extension = EXT_CONFIG

  public readonly completionTriggerCharacters: readonly string[] = [
    DICTIONARY_REF_PREFIX,
    CONFIG_REF_PREFIX,
    PROPERTY_NAME_SEGMENT_SEPARATOR,
    COMPONENT_PROPERTY_SEPARATOR,
  ]

  public diagnostics(doc: TextDocument, context: ILanguageContext): Diagnostic[] {
    const envelope = diagnoseDataEnvelope(doc)

    if (envelope.parseOk && envelope.body !== undefined) {
      const { entries } = parseJsonc(envelope.body)

      diagnoseUnusedEntries(
        doc,
        "config",
        entries,
        envelope.bodyStart,
        context.index,
        context.unusedEntrySeverity,
        envelope.diagnostics,
      )
    }

    return envelope.diagnostics
  }

  public completion(doc: TextDocument, position: Position, context: ILanguageContext): CompletionItem[] {
    const offset = doc.offsetAt(position)
    const text = doc.getText()
    const before = text.slice(0, offset)
    const line = before.slice(before.lastIndexOf("\n") + 1)

    return (
      frontmatterCompletion(doc, offset, text, line) ??
      referenceCompletion(doc, offset, line, context.index) ??
      entryKeyCompletion(doc, position, "config", context.index) ??
      []
    )
  }

  public hover(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null {
    return entryKeyHover(doc, position, "config", context.index)
  }
}
