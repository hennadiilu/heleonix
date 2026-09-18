import { splitOnTopLevel } from "../interpolation/splitOnTopLevel"
import { CONVERTER_PIPE } from "./CONVERTER_PIPE"
import type { IConverterCall } from "./IConverterCall"
import type { IBindingExpression } from "./IBindingExpression"
import { parseBindingExpression } from "./parseBindingExpression"

const ARGUMENT_SEPARATOR = ","
const NAME_VALUE_SEPARATOR = ":"

// A converter segment is an immutable string that reappears on every recompute
// of a binding, so its parse is cached: callers treat the result as read-only.
const cache = new Map<string, IConverterCall>()

export function parseConverterCall(segment: string): IConverterCall {
  const cached = cache.get(segment)

  if (cached !== undefined) {
    return cached
  }

  const call = parseSegment(segment)

  cache.set(segment, call)

  return call
}

function parseSegment(segment: string): IConverterCall {
  const trimmed = segment.trim()
  const parenAt = trimmed.indexOf("(")

  if (parenAt < 0) {
    return { name: trimmed, args: {} }
  }

  const name = trimmed.slice(0, parenAt).trim()
  const inside = trimmed.slice(parenAt + 1, trimmed.lastIndexOf(")")).trim()

  if (inside === "") {
    throw new Error(`Converter '${name}' has empty parentheses - write it bare as '${name}'.`)
  }

  const args: Record<string, IBindingExpression> = {}

  for (const part of splitOnTopLevel(inside, ARGUMENT_SEPARATOR)) {
    const colonAt = part.indexOf(NAME_VALUE_SEPARATOR)

    if (colonAt < 0) {
      throw new Error(`Converter '${name}' argument '${part.trim()}' must be named as 'name: value'.`)
    }

    const argName = part.slice(0, colonAt).trim()
    const expression = parseBindingExpression(part.slice(colonAt + 1).trim())

    if (expression.converters) {
      throw new Error(
        `Converter '${name}' argument '${argName}' must be a plain source, not a '${CONVERTER_PIPE}' chain.`,
      )
    }

    args[argName] = expression
  }

  return { name, args }
}
