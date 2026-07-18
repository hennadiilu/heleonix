import { PROPERTY_NAME_SEGMENT_SEPARATOR } from "./PROPERTY_NAME_SEGMENT_SEPARATOR"

export function getPropertySegments(path: string): string[] {
  return path ? path.split(PROPERTY_NAME_SEGMENT_SEPARATOR).filter(Boolean) : []
}
