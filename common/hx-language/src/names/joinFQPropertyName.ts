import { COMPONENT_NAME_SEGMENT_SEPARATOR } from "./COMPONENT_NAME_SEGMENT_SEPARATOR"
import { COMPONENT_PROPERTY_SEPARATOR } from "./COMPONENT_PROPERTY_SEPARATOR"
import type { FQPropertyName } from "./FQPropertyName"

/**
 * Grammar of fully-qualified names used across the Heleonix DSL.
 *
 *   FQComponentName       := segment ( "." segment )*
 *   FQPropertyName        := FQComponentName ":" propertyPath
 *   propertyPath          := identifier ( "." identifier )*
 *   FQDictionaryEntryName := dictionaryName "." entryName
 *   FQConfigEntryName     := configName "." entryName
 *
 * All separators are exposed as standalone constants so consumers reference
 * them by role rather than by glyph; the grammar can evolve without churning
 * call sites.
 */
export function joinFQPropertyName(component: string, property: string): FQPropertyName {
  if (property.indexOf(COMPONENT_PROPERTY_SEPARATOR) >= 0) {
    return component + COMPONENT_NAME_SEGMENT_SEPARATOR + property
  }

  return component + COMPONENT_PROPERTY_SEPARATOR + property
}
