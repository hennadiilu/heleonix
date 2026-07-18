import { COMPONENT_NAME_SEGMENT_SEPARATOR } from "./COMPONENT_NAME_SEGMENT_SEPARATOR"
import type { FQComponentName } from "./FQComponentName"

export function joinFQComponentName(prefix: string | undefined, name: string | undefined): FQComponentName {
  if (!prefix) {
    return name ?? ""
  }

  return name ? prefix + COMPONENT_NAME_SEGMENT_SEPARATOR + name : prefix
}
