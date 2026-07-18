import { COMPONENT_PROPERTY_SEPARATOR } from "@heleonix/hx-language"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { headSegment } from "../../references/headSegment"
import { DICTIONARY_MESSAGES } from "./dictionaryMessages"

/**
 * Resolves a `{...}` state parameter inside a dictionary value against the
 * components that reference this entry (`@Dic.entry`). Returns an issue message
 * when the parameter cannot be a property of any of those components, or
 * `undefined` when it resolves (or when the entry has no referrers, in which
 * case there is nothing to resolve against - the unused-entry check covers it).
 *
 *   - `{some.state}`        -> head `some` must be in a referrer's property pool.
 *   - `{ctrl:some.state}`   -> `ctrl` must be a named control of a referrer, and
 *                              head `some` must be a property of that control's tag.
 *
 * Matching is head-only (deeper path semantics are still TBD in the framework).
 */
export function parameterIssue(
  dictName: string,
  key: string,
  param: string,
  index: DefinitionIndex,
): string | undefined {
  const referrers = index.entryReferrers("dictionary", dictName, key)

  if (referrers.length === 0) {
    return undefined
  }

  const colon = param.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  return colon >= 0
    ? qualifiedIssue(param.slice(0, colon).trim(), param.slice(colon + 1), referrers, index)
    : plainIssue(param, referrers, index)
}

function plainIssue(param: string, referrers: readonly string[], index: DefinitionIndex): string | undefined {
  const head = headSegment(param)

  if (!head) {
    return undefined
  }

  for (const component of referrers) {
    if (hasPropertyHead(index.componentProperties(component), head)) {
      return undefined
    }
  }

  return DICTIONARY_MESSAGES.unknownParameter(param)
}

function qualifiedIssue(
  control: string,
  statePath: string,
  referrers: readonly string[],
  index: DefinitionIndex,
): string | undefined {
  const tags = new Set<string>()

  for (const component of referrers) {
    for (const tag of index.controlTags(component, control)) {
      tags.add(tag)
    }
  }

  if (tags.size === 0) {
    return DICTIONARY_MESSAGES.unknownControl(control)
  }

  const head = headSegment(statePath)

  if (!head) {
    return undefined
  }

  for (const tag of tags) {
    if (hasPropertyHead(index.componentProperties(tag), head)) {
      return undefined
    }
  }

  return DICTIONARY_MESSAGES.unknownControlProperty(control, head)
}

/** Whether any property path in `pool` has `head` as its head segment. */
function hasPropertyHead(pool: readonly string[], head: string): boolean {
  return pool.some((property) => headSegment(property) === head)
}
