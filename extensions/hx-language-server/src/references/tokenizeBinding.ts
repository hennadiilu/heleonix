import {
  CONVERTER_PIPE,
  COMPONENT_PROPERTY_SEPARATOR,
  IDENTIFIER_PART,
  PROPERTY_NAME_SEGMENT_SEPARATOR,
  REFERENCE_PREFIXES,
  REFERENCE_TYPES,
  ReferenceType,
} from "@heleonix/hx-language"
import type { BindingTokenKind } from "./BindingTokenKind"
import type { IBindingToken } from "./IBindingToken"

const IDENTIFIER = new RegExp(IDENTIFIER_PART)

// Reference kind keyed by its leading prefix character (`@`, `#`, ...), so a
// new ReferenceType (e.g. a future `$theme.path`) needs no new branch here.
const KIND_BY_PREFIX: ReadonlyMap<string, ReferenceType> = new Map(
  REFERENCE_TYPES.map((kind) => [REFERENCE_PREFIXES[kind], kind]),
)

const PREFIX_TOKEN: Readonly<Record<ReferenceType, BindingTokenKind>> = {
  dictionary: "dictionaryPrefix",
  config: "configPrefix",
}

const NAME_TOKEN: Readonly<Record<ReferenceType, BindingTokenKind>> = {
  dictionary: "dictionaryName",
  config: "configName",
}

/**
 * Tokenizes a binding expression `source ( "|" converter )*` into classified,
 * offset-bearing spans (see {@link BindingTokenKind}). Error-tolerant: any
 * unexpected character is skipped. Offsets are relative to `expression`.
 *
 *   - `@dict.entry`   -> dictionaryPrefix, dictionaryName, separator, dictionaryName
 *   - `#config.entry` -> configPrefix, configName, separator, configName
 *   - `state.path`    -> stateName (+ separators); a `component:` prefix -> componentName
 *   - `| converter`   -> pipe, converter
 */
export function tokenizeBinding(expression: string): IBindingToken[] {
  const tokens: IBindingToken[] = []
  const trimmed = expression.trim()
  const refKind = KIND_BY_PREFIX.get(trimmed.charAt(0))

  // A component-qualified state ref carries the component name before the first
  // ':' within the source segment (before any converter pipe).
  const sourceEnd = indexOrEnd(expression, CONVERTER_PIPE)
  let componentPrefix = !refKind && expression.slice(0, sourceEnd).includes(COMPONENT_PROPERTY_SEPARATOR)

  let inConverter = false
  let i = 0

  while (i < expression.length) {
    const c = expression.charAt(i)

    if (c === CONVERTER_PIPE) {
      tokens.push({ kind: "pipe", start: i, length: 1 })
      inConverter = true
      componentPrefix = false
      i++
      continue
    }

    const prefixKind = KIND_BY_PREFIX.get(c)

    if (prefixKind) {
      tokens.push({ kind: PREFIX_TOKEN[prefixKind], start: i, length: 1 })
      i++
      continue
    }

    if (c === PROPERTY_NAME_SEGMENT_SEPARATOR || c === COMPONENT_PROPERTY_SEPARATOR) {
      tokens.push({ kind: "separator", start: i, length: 1 })

      if (c === COMPONENT_PROPERTY_SEPARATOR) {
        componentPrefix = false // identifiers after ':' are the property path
      }

      i++
      continue
    }

    if (IDENTIFIER.test(c)) {
      let j = i

      while (j < expression.length && IDENTIFIER.test(expression.charAt(j))) {
        j++
      }

      tokens.push({ kind: identifierKind(inConverter, refKind, componentPrefix), start: i, length: j - i })
      i = j
      continue
    }

    i++ // whitespace or any other character
  }

  return tokens
}

function identifierKind(
  inConverter: boolean,
  refKind: ReferenceType | undefined,
  componentPrefix: boolean,
): BindingTokenKind {
  if (inConverter) {
    return "converter"
  }

  if (refKind) {
    return NAME_TOKEN[refKind]
  }

  return componentPrefix ? "componentName" : "stateName"
}

function indexOrEnd(text: string, char: string): number {
  const index = text.indexOf(char)
  return index === -1 ? text.length : index
}
