/**
 * Joins the qualifier segments of a compiled style rule key (AND / nesting):
 * `Hover&Media(query:(max-width:600px))`. Chosen over `/` because `/` occurs in
 * canonical CSS values (`16/9`) while `&` never does, so segment splitting stays
 * unambiguous. Read paren/quote/brace-aware: only a top-level `&` separates.
 */
export const RULE_KEY_SEPARATOR = "&"
