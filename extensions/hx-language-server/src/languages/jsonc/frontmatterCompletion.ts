import {
  FRONTMATTER_FENCE,
  FRONTMATTER_KEYS,
  FRONTMATTER_OPEN_PATTERN,
  USAGE_KEY,
  USAGE_VALUES,
} from "@heleonix/hx-language"
import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { completionItem } from "../../lsp/completionItem"
import { replaceRange } from "../../lsp/replaceRange"

const FRONTMATTER_OPEN = new RegExp(FRONTMATTER_OPEN_PATTERN)
const FRONTMATTER_CLOSE = new RegExp(`^[ \\t]*${FRONTMATTER_FENCE}[ \\t]*$`, "m")
const FRONTMATTER_KEY = /([A-Za-z_][\w-]*)?$/
const FRONTMATTER_ENTRY = /^[ \t]*([A-Za-z_][\w-]*)[ \t]*:[ \t]*(\S*)$/

/**
 * Completion inside the `--- ... ---` header of `*.hxd`/`*.hxc`: keys at line
 * start, and the allowed values after `usage:`. Returns `undefined` when the
 * cursor is not in the frontmatter.
 */
export function frontmatterCompletion(
  doc: TextDocument,
  offset: number,
  text: string,
  line: string,
): CompletionItem[] | undefined {
  if (!inFrontmatter(text, offset)) {
    return undefined
  }

  const entry = FRONTMATTER_ENTRY.exec(line)

  if (entry) {
    if (entry[1] === USAGE_KEY) {
      const range = replaceRange(doc, offset, entry[2].length)
      return USAGE_VALUES.map((value) => completionItem(value, CompletionItemKind.EnumMember, range))
    }

    return []
  }

  const typed = FRONTMATTER_KEY.exec(line)?.[1] ?? ""
  const range = replaceRange(doc, offset, typed.length)

  return FRONTMATTER_KEYS.map((key) => completionItem(key, CompletionItemKind.Property, range))
}

function inFrontmatter(text: string, offset: number): boolean {
  const open = FRONTMATTER_OPEN.exec(text)

  if (!open || offset < open[0].length) {
    return false
  }

  const rest = text.slice(open[0].length)
  const close = FRONTMATTER_CLOSE.exec(rest)

  return !close || offset < open[0].length + close.index
}
