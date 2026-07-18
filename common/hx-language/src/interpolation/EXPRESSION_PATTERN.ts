import { CLOSE } from "./CLOSE"
import { OPEN } from "./OPEN"

/**
 * Regex source matching a single `{ ... }` interpolation occurrence (capturing
 * the inner expression). Exposed as a source string - not a compiled `RegExp` -
 * so each consumer compiles its own instance with the flags it needs and never
 * shares mutable `lastIndex` state. Use `new RegExp(EXPRESSION_PATTERN, "g")`
 * to scan all occurrences.
 */
export const EXPRESSION_PATTERN = `\\${OPEN}([^${CLOSE}]+)\\${CLOSE}`
