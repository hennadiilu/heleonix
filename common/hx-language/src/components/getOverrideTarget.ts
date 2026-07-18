import { COMPONENT_PROPERTY_SEPARATOR } from "../names/COMPONENT_PROPERTY_SEPARATOR"
import { OVERRIDE_PROPERTY } from "./OVERRIDE_PROPERTY"

/**
 * The override target chain of a `target:Component` attribute or tag name (the
 * part before `:Component`), or `undefined` when the name is not a component
 * override. A leading `:Component` with no target is not an override.
 */
export function getOverrideTarget(name: string): string | undefined {
  const separator = name.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  if (separator <= 0 || name.slice(separator + 1) !== OVERRIDE_PROPERTY) {
    return undefined
  }

  return name.slice(0, separator)
}
