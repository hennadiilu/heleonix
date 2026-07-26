import { splitOnTopLevel } from "../interpolation/splitOnTopLevel"
import { CONFIG_ENTRY_SEPARATOR } from "../names/CONFIG_ENTRY_SEPARATOR"
import { DICTIONARY_ENTRY_SEPARATOR } from "../names/DICTIONARY_ENTRY_SEPARATOR"
import { IDENTIFIER_PATTERN } from "../names/IDENTIFIER_PATTERN"
import { CONFIG_REF_PREFIX } from "./CONFIG_REF_PREFIX"
import { CONVERTER_PIPE } from "./CONVERTER_PIPE"
import { DICTIONARY_REF_PREFIX } from "./DICTIONARY_REF_PREFIX"
import { isLiteralSource } from "./isLiteralSource"
import { isStringLiteralSource } from "./isStringLiteralSource"

const IDENTIFIER = new RegExp(`^${IDENTIFIER_PATTERN}$`)
const CONVERTER_SEGMENT = new RegExp(`^${IDENTIFIER_PATTERN}\\s*(\\([\\s\\S]*\\))?$`)
const STATE_REF = new RegExp(`^${IDENTIFIER_PATTERN}([.:]${IDENTIFIER_PATTERN})*$`)
const QUALIFIED_NAME = new RegExp(`^${IDENTIFIER_PATTERN}(\\.${IDENTIFIER_PATTERN})*$`)

function isEntryRef(ref: string, separator: string): boolean {
  const splitIndex = ref.lastIndexOf(separator)

  if (splitIndex <= 0) {
    return false
  }

  const name = ref.slice(0, splitIndex)
  const entry = ref.slice(splitIndex + 1)

  return QUALIFIED_NAME.test(name) && IDENTIFIER.test(entry)
}

/**
 * Grammar of binding expressions as used in `*.hxm` templates and any
 * other Heleonix source that accepts bindings.
 *
 *   expression  := source ( "|" converter )*
 *   converter   := identifier [ "(" args ")" ]
 *   source      := literal | stateRef | dictRef | configRef
 *   literal     := "true" | "false" | number | "'" text "'"
 *   stateRef    := identifier ( "." identifier )*
 *   dictRef     := "@" dictionaryName "." entryName
 *   configRef   := "#" configName "." entryName
 *   dictionaryName := identifier ( "." identifier )*
 *   configName     := identifier ( "." identifier )*
 *   entryName      := identifier
 *
 * A string literal is single-quoted (`'primary'`); it is only valid where a
 * vocabulary or `string` type is declared, and the analyzer type-checks it -
 * a bare unquoted string is always a reference, never a literal.
 *
 * Examples:
 *   "data.user"                            - state      "data.user"
 *   "@Buttons.add"                         - dictionary "Buttons.add"
 *   "#UIConfig.isReadonly | converter1"    - config     "UIConfig.isReadonly" with converter
 *   "'primary'"                            - literal    (string, enum-typed)
 *   "true", "42", "-1.5"                   - literal    (boolean/number)
 */
export function isBindingExpression(raw: string): boolean {
  const trimmed = raw.trim()

  if (!trimmed) {
    return false
  }

  const segments = splitOnTopLevel(trimmed, CONVERTER_PIPE)
  const source = segments[0].trim()

  if (!source) {
    return false
  }

  for (const segment of segments.slice(1)) {
    const converter = segment.trim()

    if (!converter || !CONVERTER_SEGMENT.test(converter)) {
      return false
    }
  }

  if (source.charAt(0) === DICTIONARY_REF_PREFIX) {
    return isEntryRef(source.slice(1).trim(), DICTIONARY_ENTRY_SEPARATOR)
  }

  if (source.charAt(0) === CONFIG_REF_PREFIX) {
    return isEntryRef(source.slice(1).trim(), CONFIG_ENTRY_SEPARATOR)
  }

  if (isStringLiteralSource(source) || isLiteralSource(source)) {
    return true
  }

  return STATE_REF.test(source)
}
