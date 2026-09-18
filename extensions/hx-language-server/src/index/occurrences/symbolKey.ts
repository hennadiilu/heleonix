import { ReferenceType } from "@heleonix/hx-language"

// `|` can never appear in a Heleonix identifier or dotted name, so joined parts
// stay unambiguous. The leading kind tag keeps the four symbol namespaces disjoint.
const SEP = "|"

export const symbolKey = {
  component: (name: string): string => `component${SEP}${name}`,

  entry: (kind: ReferenceType, name: string, entry: string): string => `${kind}${SEP}${name}${SEP}${entry}`,

  property: (component: string, head: string): string => `property${SEP}${component}${SEP}${head}`,
}
