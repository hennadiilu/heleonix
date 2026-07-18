import {
  COMPONENT_PROPERTY_SEPARATOR,
  CONFIG_REF_PREFIX,
  DICTIONARY_REF_PREFIX,
  EXT_DICTIONARY,
  Kind,
  PROPERTY_NAME_SEGMENT_SEPARATOR,
} from "@heleonix/hx-language"
import { CompletionItem, Diagnostic, Hover, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { ILanguageContext } from "../ILanguageContext"
import { ILanguageService } from "../ILanguageService"
import { referenceCompletion } from "../../references/referenceCompletion"
import { entryKeyCompletion } from "../jsonc/entryKeyCompletion"
import { entryKeyHover } from "../jsonc/entryKeyHover"
import { frontmatterCompletion } from "../jsonc/frontmatterCompletion"
import { diagnoseDictionary } from "./dictionaryDiagnostics"
import { parameterCompletion } from "./parameterCompletion"

/** Language service for `*.hxd` dictionaries. */
export class DictionaryLanguageService implements ILanguageService {
  public readonly kind: Kind = "dictionary"

  public readonly extension = EXT_DICTIONARY

  public readonly completionTriggerCharacters: readonly string[] = [
    DICTIONARY_REF_PREFIX,
    CONFIG_REF_PREFIX,
    PROPERTY_NAME_SEGMENT_SEPARATOR,
    COMPONENT_PROPERTY_SEPARATOR,
  ]

  public diagnostics(doc: TextDocument, context: ILanguageContext): Diagnostic[] {
    return diagnoseDictionary(doc, context.index, context.unknownReferenceSeverity, context.unusedEntrySeverity)
  }

  public completion(doc: TextDocument, position: Position, context: ILanguageContext): CompletionItem[] {
    const offset = doc.offsetAt(position)
    const text = doc.getText()
    const before = text.slice(0, offset)
    const line = before.slice(before.lastIndexOf("\n") + 1)

    return (
      frontmatterCompletion(doc, offset, text, line) ??
      referenceCompletion(doc, offset, line, context.index) ??
      parameterCompletion(doc, position, context.index) ??
      entryKeyCompletion(doc, position, "dictionary", context.index) ??
      []
    )
  }

  public hover(doc: TextDocument, position: Position, context: ILanguageContext): Hover | null {
    return entryKeyHover(doc, position, "dictionary", context.index)
  }
}
