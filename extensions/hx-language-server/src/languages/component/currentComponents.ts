import { IDENTIFIER_PATTERN } from "@heleonix/hx-language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { definitionName } from "../jsonc/definitionName"

// Inline component name declared by a leading comment, e.g. `<!--CustomAddButton-->`.
// Mirrors the pattern used while indexing in WorkspaceDefinitionSource.
const COMPONENT_COMMENT = new RegExp(`<!--\\s*(${IDENTIFIER_PATTERN}(?:\\.${IDENTIFIER_PATTERN})*)`, "g")

/**
 * Names of the components defined in a `*.hxm` document: the file's base name
 * (its default component) plus each inline `<!--Name-->` declaration. Matches
 * the attribution rule in WorkspaceDefinitionSource so a file's state bindings
 * resolve against the same component keys the index is built under.
 */
export function currentComponents(doc: TextDocument): string[] {
  const names = [definitionName(doc.uri)]
  const text = doc.getText()

  COMPONENT_COMMENT.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = COMPONENT_COMMENT.exec(text)) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1])
    }
  }

  return names
}
