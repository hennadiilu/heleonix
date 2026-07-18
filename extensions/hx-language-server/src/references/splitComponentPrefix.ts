import { COMPONENT_PROPERTY_SEPARATOR } from "@heleonix/hx-language"

/**
 * Splits a binding name into its optional component-navigation prefix (before
 * the first `:`) and the property path (after it):
 *
 *   - `add:text`              -> { prefix: "add",       path: "text" }
 *   - `child.desc:prop.sub`   -> { prefix: "child.desc", path: "prop.sub" }
 *   - `some.state`            -> { prefix: "",          path: "some.state" }
 *
 * The prefix names a chain of nested `name="..."` controls to descend into; the
 * path is a property of the component that chain resolves to. Used for both
 * attribute names (the property being set) and state-binding values (the
 * property being read).
 */
export function splitComponentPrefix(name: string): { prefix: string; path: string } {
  const colon = name.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  return colon < 0 ? { prefix: "", path: name } : { prefix: name.slice(0, colon), path: name.slice(colon + 1) }
}
