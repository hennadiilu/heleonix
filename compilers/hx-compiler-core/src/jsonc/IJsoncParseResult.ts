import type { IFlatObjectIssue } from "./IFlatObjectIssue"
import type { IJsoncComment } from "./IJsoncComment"
import type { IJsoncEntry } from "./IJsoncEntry"

/**
 * Output of the error-tolerant {@link parseJsonc}: the parsed value plus every
 * document-root flatness violation, in document order. Mirrors
 * {@link IXmlParseResult}.
 *
 * Flatness is the `*.hxd` dictionary constraint and is always collected, never
 * thrown - `*.hxc` configs simply ignore `issues`. JSONC syntax errors are
 * thrown rather than collected, so a result is produced only for syntactically
 * valid input.
 *
 * `entries` holds the source spans of the root object's top-level `key: value`
 * pairs (empty when the root is not an object), so tooling can map an offset to
 * its entry; `comments` and `rootStart` (offset of the root value's first
 * character) let doc comments be associated with the entry or root they
 * precede. The build path ({@link JsoncParser}) ignores all three.
 */
export interface IJsoncParseResult {
  value: unknown

  issues: IFlatObjectIssue[]

  entries: IJsoncEntry[]

  comments: IJsoncComment[]

  rootStart: number
}
