import { SemanticTokensLegend } from "vscode-languageserver"

/**
 * Semantic token types emitted for `*.hxm`. Every entry is a standard LSP token
 * type so the active theme colors it - nothing is hard-coded.
 */
export const TOKEN_TYPES = [
  "class", // user component tags (defined in any definition source)
  "property", // attribute / property names; component name before ':' (+readonly)
  "variable", // state references; declared control names; component name in a state binding (+readonly)
  "string", // dictionary references: @Buttons.add
  "number", // config references: #UIConfig.isReadonly (+readonly)
  "function", // converters after '|'
  "keyword", // built-in framework tags; the `name` attribute
  "operator", // binding separators: | : .
  "namespace", // the root <Component> tag
] as const

export const TOKEN_MODIFIERS = [
  "readonly", // config refs; name="..." value; component name before ':' in a property name or state binding
] as const

export const TOKEN_TYPE = Object.fromEntries(TOKEN_TYPES.map((name, index) => [name, index])) as Readonly<
  Record<(typeof TOKEN_TYPES)[number], number>
>

export const TOKEN_MODIFIER = Object.fromEntries(TOKEN_MODIFIERS.map((name, index) => [name, 1 << index])) as Readonly<
  Record<(typeof TOKEN_MODIFIERS)[number], number>
>

export const LEGEND: SemanticTokensLegend = {
  tokenTypes: [...TOKEN_TYPES],
  tokenModifiers: [...TOKEN_MODIFIERS],
}
