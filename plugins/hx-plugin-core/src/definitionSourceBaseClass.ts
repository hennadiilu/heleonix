import type { Kind } from "@heleonix/hx-language"

/** Runtime base class (from `@heleonix/hx-core`) each kind's generated source extends. */
export const DEFINITION_SOURCE_BASE_CLASS: Readonly<Record<Kind, string>> = {
  component: "ComponentDefinitionSource",
  dictionary: "DictionaryDefinitionSource",
  config: "ConfigDefinitionSource",
  style: "StyleDefinitionSource",
  theme: "ThemeDefinitionSource",
}
