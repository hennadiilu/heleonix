import type { Kind } from "@heleonix/hx-language"

export const DEFINITION_INTERFACE_NAME: Readonly<Record<Kind, string>> = {
  component: "IComponentDefinition",
  dictionary: "IDictionaryDefinition",
  config: "IConfigDefinition",
  style: "IStyleDefinition",
  theme: "IThemeDefinition",
}
