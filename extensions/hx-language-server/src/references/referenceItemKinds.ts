import { CompletionItemKind } from "vscode-languageserver"
import type { ReferenceType } from "@heleonix/hx-language"

/**
 * Completion item kinds per reference type, mirroring the semantic token legend
 * as closely as `CompletionItemKind` allows: dictionary references render as
 * `string` tokens, config references as readonly `number` tokens.
 */
export const REFERENCE_ITEM_KINDS: Readonly<Record<ReferenceType, CompletionItemKind>> = {
  dictionary: CompletionItemKind.Text,
  config: CompletionItemKind.Constant,
}
