/**
 * Neutral classification of a span inside a binding expression. Editor layers
 * map these to their own coloring; nothing here is LSP- or theme-specific.
 *
 *   dictionaryPrefix  the `@` of a dictionary reference
 *   configPrefix      the `#` of a config reference
 *   dictionaryName    an identifier inside a dictionary reference
 *   configName        an identifier inside a config reference
 *   stateName         an identifier inside a state reference (property path)
 *   componentName     an identifier before `:` in a component-qualified state ref
 *   converter         an identifier after `|`
 *   separator         a `.` or `:` between identifiers
 *   pipe              the `|` before a converter
 */
export type BindingTokenKind =
  | "dictionaryPrefix"
  | "configPrefix"
  | "dictionaryName"
  | "configName"
  | "stateName"
  | "componentName"
  | "converter"
  | "separator"
  | "pipe"
