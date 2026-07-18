import { splitOnTopLevel } from "../interpolation/splitOnTopLevel"
import type { BindingType } from "./BindingType"
import { CONFIG_REF_PREFIX } from "./CONFIG_REF_PREFIX"
import { CONVERTER_PIPE } from "./CONVERTER_PIPE"
import { DICTIONARY_REF_PREFIX } from "./DICTIONARY_REF_PREFIX"
import type { IBindingExpression } from "./IBindingExpression"

export function parseBindingExpression(raw: string): IBindingExpression {
  const segments = splitOnTopLevel(raw, CONVERTER_PIPE)
  const source = segments[0].trim()
  const converters = segments
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean)

  let type: BindingType
  let value: string

  if (source.charAt(0) === DICTIONARY_REF_PREFIX) {
    type = "dictionary"
    value = source.slice(1).trim()
  } else if (source.charAt(0) === CONFIG_REF_PREFIX) {
    type = "config"
    value = source.slice(1).trim()
  } else {
    type = "state"
    value = source
  }

  return converters.length > 0 ? { type, value, converters } : { type, value }
}
