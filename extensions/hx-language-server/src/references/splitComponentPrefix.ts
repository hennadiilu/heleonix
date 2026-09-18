import { COMPONENT_PROPERTY_SEPARATOR } from "@heleonix/hx-language"

export function splitComponentPrefix(name: string): { prefix: string; path: string } {
  const colon = name.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  return colon < 0 ? { prefix: "", path: name } : { prefix: name.slice(0, colon), path: name.slice(colon + 1) }
}
