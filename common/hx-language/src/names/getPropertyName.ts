import { COMPONENT_PROPERTY_SEPARATOR } from "./COMPONENT_PROPERTY_SEPARATOR"
import type { FQPropertyName } from "./FQPropertyName"

export function getPropertyName(fqName: FQPropertyName): string {
  return fqName ? fqName.slice(fqName.indexOf(COMPONENT_PROPERTY_SEPARATOR) + 1) : ""
}
