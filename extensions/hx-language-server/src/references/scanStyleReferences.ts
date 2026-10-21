import { IDENTIFIER_PATTERN, REFERENCE_PREFIXES, REFERENCE_SEPARATORS, REFERENCE_TYPES } from "@heleonix/hx-language"
import type { ReferenceType } from "@heleonix/hx-language"
import type { IInterpolationRef } from "./IInterpolationRef"
import { blankComments } from "./blankComments"

const KIND_BY_PREFIX: ReadonlyMap<string, ReferenceType> = new Map(
  REFERENCE_TYPES.map((kind) => [REFERENCE_PREFIXES[kind], kind]),
)

// Anchored on the identifier grammar, so a block body (`{ @hx-apply(token: A.B); }`)
// or a hex color (`#fff`) never reads as a reference; a converter pipe may follow.
const REFERENCE = new RegExp(
  `\\{\\s*([${[...KIND_BY_PREFIX.keys()].join("")}])(${IDENTIFIER_PATTERN}(?:\\.${IDENTIFIER_PATTERN})+)\\s*(?:\\|[^{}]*)?\\}`,
  "g",
)

export function scanStyleReferences(source: string): IInterpolationRef[] {
  const refs: IInterpolationRef[] = []
  const text = blankComments(source)
  const pattern = new RegExp(REFERENCE.source, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const kind = KIND_BY_PREFIX.get(match[1])!
    const path = match[2]
    const split = path.lastIndexOf(REFERENCE_SEPARATORS[kind])
    const start = match.index + match[0].indexOf(match[1])

    refs.push({ kind, name: path.slice(0, split), entry: path.slice(split + 1), start, end: start + 1 + path.length })
  }

  return refs
}
