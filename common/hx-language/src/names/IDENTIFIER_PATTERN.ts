import { IDENTIFIER_PART } from "./IDENTIFIER_PART"

/**
 * Regex source for a single Heleonix identifier: a leading letter or underscore
 * followed by letters, digits or underscores. The building block for dictionary,
 * config, component and state names as well as converter names. Exposed as a
 * source string (not a `RegExp`) so consumers can anchor or compose it for their
 * own context (whole-string validation, qualified names, cursor completion).
 */
export const IDENTIFIER_PATTERN = `[A-Za-z_]${IDENTIFIER_PART}*`
