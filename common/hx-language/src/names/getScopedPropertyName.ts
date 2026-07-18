import type { FQComponentName } from "./FQComponentName"
import type { FQPropertyName } from "./FQPropertyName"

export function getScopedPropertyName(fqParentName: FQComponentName, fqPropertyName: FQPropertyName): string {
  return fqPropertyName.substring(fqParentName.length + 1)
}
