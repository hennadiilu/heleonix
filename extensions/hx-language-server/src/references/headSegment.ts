import { COMPONENT_PROPERTY_SEPARATOR, PROPERTY_NAME_SEGMENT_SEPARATOR } from "@heleonix/hx-language"

/**
 * The head identifier of a state/property path - the segment matched against a
 * component's property pool. `data.user` -> `data`, `add:text` -> `add`. Deeper
 * path semantics are still TBD in the framework spec, so matching is head-only.
 */
export function headSegment(path: string): string {
  const trimmed = path.trim()

  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed.charAt(i)

    if (c === PROPERTY_NAME_SEGMENT_SEPARATOR || c === COMPONENT_PROPERTY_SEPARATOR) {
      return trimmed.slice(0, i)
    }
  }

  return trimmed
}
