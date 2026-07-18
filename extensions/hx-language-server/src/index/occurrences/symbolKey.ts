import { ReferenceType } from "@heleonix/hx-language"

// `|` can never appear in a Heleonix identifier or dotted name, so joined parts
// stay unambiguous. The leading kind tag keeps the four symbol namespaces disjoint.
const SEP = "|"

/**
 * Builds the stable string identity two occurrences must share to be the same
 * symbol. One builder per navigable symbol kind:
 *
 *   - `component`  : a component tag (`<Name>` / `<!--Name-->` / file base name).
 *   - `entry`      : a dictionary/config entry (`@Name.entry` / `#Name.entry`, `.hxd`/`.hxc` key).
 *   - `property`   : a property of a component (its head identifier).
 */
export const symbolKey = {
  component: (name: string): string => `component${SEP}${name}`,

  entry: (kind: ReferenceType, name: string, entry: string): string => `${kind}${SEP}${name}${SEP}${entry}`,

  property: (component: string, head: string): string => `property${SEP}${component}${SEP}${head}`,
}
