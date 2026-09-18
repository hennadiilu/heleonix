import { COMPONENT_PROPERTY_SEPARATOR, PROPERTY_NAME_SEGMENT_SEPARATOR } from "@heleonix/hx-language"

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
