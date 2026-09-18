import type { Kind } from "@heleonix/hx-language"

export const DEFINITION_SOURCE_BASE_CLASS: Readonly<Record<Kind, string>> = {
  component: "DefinitionSource",
  dictionary: "DefinitionSource",
  config: "DefinitionSource",
  style: "DefinitionSource",
  theme: "AggregateDefinitionSource",
}
