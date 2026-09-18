import { CompletionItemKind } from "vscode-languageserver"
import type { ReferenceType } from "@heleonix/hx-language"

export const REFERENCE_ITEM_KINDS: Readonly<Record<ReferenceType, CompletionItemKind>> = {
  dictionary: CompletionItemKind.Text,
  config: CompletionItemKind.Constant,
}
