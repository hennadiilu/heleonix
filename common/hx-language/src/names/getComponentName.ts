import { COMPONENT_PROPERTY_SEPARATOR } from "./COMPONENT_PROPERTY_SEPARATOR"
import type { FQComponentName } from "./FQComponentName"
import type { FQPropertyName } from "./FQPropertyName"

export function getComponentName(fqName: FQPropertyName): FQComponentName {
  return fqName ? fqName.slice(0, fqName.indexOf(COMPONENT_PROPERTY_SEPARATOR)) : ""
}
