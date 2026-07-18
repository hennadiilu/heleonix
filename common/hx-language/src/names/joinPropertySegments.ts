import { PROPERTY_NAME_SEGMENT_SEPARATOR } from "./PROPERTY_NAME_SEGMENT_SEPARATOR"

export function joinPropertySegments(base: string | undefined, segment: string | undefined): string {
  if (!base) {
    return segment ?? ""
  }

  return segment ? base + PROPERTY_NAME_SEGMENT_SEPARATOR + segment : base
}
