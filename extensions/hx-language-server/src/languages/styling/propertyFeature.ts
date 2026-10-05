import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import { completionItem } from "../../lsp/completionItem"
import { replaceRange } from "../../lsp/replaceRange"
import { openBraceBefore } from "./openBraceBefore"

const PROPERTY_PREFIX = /^[A-Za-z_]?\w*$/

const INTERPOLATION_LEADS = "$@#"

// A `{` in a declaration value (`width: {size}px`, `content: '{label}'`) or in a
// media query's parentheses (`@media (max-width: {maxWidth}px)`) reads one of
// the styled component's own properties.
export function completeProperty(
  doc: TextDocument,
  offset: number,
  components: readonly IComponentInfo[],
  componentName: string,
): CompletionItem[] | undefined {
  const text = doc.getText()
  const open = openBraceBefore(text, offset)
  const typed = open < 0 ? "" : text.slice(open + 1, offset)

  if (open < 0 || !PROPERTY_PREFIX.test(typed) || !readsProperty(text, open)) {
    return undefined
  }

  const members = components.find((component) => component.name === componentName)?.members ?? []
  const range = replaceRange(doc, offset, typed.length)

  return members.map((member) => completionItem(member.name, CompletionItemKind.Field, range, member.docs))
}

// Walks the line the way the style parser reads a node: a `:` after a property
// name starts a declaration value, and a `{` there (or one in parentheses, or
// one before `$@#`) is an interpolation rather than a block.
function readsProperty(text: string, brace: number): boolean {
  let i = Math.max(text.lastIndexOf("\n", brace - 1), text.lastIndexOf("\r", brace - 1)) + 1
  let head = ""
  let declaration = false
  let depth = 0
  let quote = ""

  while (i < brace) {
    const ch = text.charAt(i)

    if (quote) {
      if (ch === "\\") {
        i += 2

        continue
      }

      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(") {
      depth++
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1)
    } else if (ch === "{") {
      const close = text.indexOf("}", i)

      if (declaration || depth > 0 || INTERPOLATION_LEADS.includes(text.charAt(i + 1))) {
        if (close < 0 || close >= brace) {
          return false
        }

        i = close + 1

        continue
      }
    }

    if (!quote && depth === 0 && (ch === "{" || ch === ";" || ch === "}")) {
      head = ""
      declaration = false
      i++

      continue
    }

    if (!quote && ch === ":" && depth === 0 && !declaration) {
      const lead = head.trimStart().charAt(0)

      declaration = lead !== "" && lead !== ":" && lead !== "@"
    }

    head += ch
    i++
  }

  return declaration || (depth > 0 && head.trimStart().startsWith("@media"))
}
