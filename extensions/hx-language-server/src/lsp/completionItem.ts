import { CompletionItem, CompletionItemKind, MarkupKind, Range, TextEdit } from "vscode-languageserver"

/**
 * Completion item with a `textEdit` replacing the typed prefix and a
 * `filterText`; `documentation` (markdown, usually a docs summary) is attached
 * when the symbol is documented.
 */
export function completionItem(
  label: string,
  kind: CompletionItemKind,
  range: Range,
  documentation?: string,
): CompletionItem {
  const item: CompletionItem = { label, kind, filterText: label, textEdit: TextEdit.replace(range, label) }

  if (documentation) {
    item.documentation = { kind: MarkupKind.Markdown, value: documentation }
  }

  return item
}
