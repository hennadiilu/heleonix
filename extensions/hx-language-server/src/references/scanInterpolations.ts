import {
  CLOSE,
  OPEN,
  REFERENCE_PREFIXES,
  REFERENCE_SEPARATORS,
  REFERENCE_TYPES,
  ReferenceType,
} from "@heleonix/hx-language"
import type { IInterpolationRef } from "./IInterpolationRef"

// Innermost `{ ... }` (no nested braces) so document structure like a JSON
// object's `{` is never mistaken for an interpolation.
const INTERPOLATION = new RegExp(`\\${OPEN}([^\\${OPEN}\\${CLOSE}]+)\\${CLOSE}`, "g")

// Reference kind keyed by its leading prefix character (`@`, `#`, ...), so a
// new ReferenceType (e.g. a future `$theme.path`) needs no new branch here.
const KIND_BY_PREFIX: ReadonlyMap<string, ReferenceType> = new Map(
  REFERENCE_TYPES.map((kind) => [REFERENCE_PREFIXES[kind], kind]),
)

export function scanInterpolations(text: string): IInterpolationRef[] {
  const refs: IInterpolationRef[] = []
  const pattern = new RegExp(INTERPOLATION.source, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const inner = match[1].trim()
    const start = match.index
    const end = match.index + match[0].length
    const kind = KIND_BY_PREFIX.get(inner.charAt(0))

    refs.push(
      kind
        ? entryRef(kind, inner.slice(1), REFERENCE_SEPARATORS[kind], start, end)
        : { kind: "state", name: inner, start, end },
    )
  }

  return refs
}

function entryRef(kind: ReferenceType, ref: string, separator: string, start: number, end: number): IInterpolationRef {
  const split = ref.lastIndexOf(separator)

  if (split <= 0) {
    return { kind: "state", name: ref, start, end }
  }

  return { kind, name: ref.slice(0, split), entry: ref.slice(split + 1), start, end }
}
