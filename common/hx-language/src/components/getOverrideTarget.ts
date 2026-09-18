import { COMPONENT_PROPERTY_SEPARATOR } from "../names/COMPONENT_PROPERTY_SEPARATOR"
import { OVERRIDE_PROPERTY } from "./OVERRIDE_PROPERTY"

export function getOverrideTarget(name: string): string | undefined {
  const separator = name.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  if (separator <= 0 || name.slice(separator + 1) !== OVERRIDE_PROPERTY) {
    return undefined
  }

  return name.slice(0, separator)
}
