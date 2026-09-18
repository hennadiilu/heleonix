import { COMPONENT_NAME_SEGMENT_SEPARATOR } from "./COMPONENT_NAME_SEGMENT_SEPARATOR"
import { COMPONENT_PROPERTY_SEPARATOR } from "./COMPONENT_PROPERTY_SEPARATOR"
import type { FQPropertyName } from "./FQPropertyName"

export function joinFQPropertyName(component: string, property: string): FQPropertyName {
  if (property.indexOf(COMPONENT_PROPERTY_SEPARATOR) >= 0) {
    return component + COMPONENT_NAME_SEGMENT_SEPARATOR + property
  }

  return component + COMPONENT_PROPERTY_SEPARATOR + property
}
