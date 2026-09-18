import { CompletionItem, CompletionItemKind, MarkupKind, Range, TextEdit } from "vscode-languageserver"

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
