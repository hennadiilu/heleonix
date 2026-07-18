import { FRONTMATTER_FENCE } from "./FRONTMATTER_FENCE"

/**
 * Regex source matching the opening fence line of a frontmatter block: a leading
 * `---` line at the very start of the source (leading whitespace/BOM tolerated).
 * Exposed as a source string so consumers compose it - the compiler as the prefix
 * of its body-extraction pattern, the language server as a cursor-position probe.
 */
export const FRONTMATTER_OPEN_PATTERN = `^\\s*${FRONTMATTER_FENCE}[ \\t]*\\r?\\n`
