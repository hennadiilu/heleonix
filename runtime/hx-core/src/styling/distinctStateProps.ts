import type { IStyleDefinition } from "@heleonix/hx-language"
import { declarationStateProps } from "./declarationStateProps"

/**
 * The distinct `{prop}` state paths across a whole style's declarations and
 * keyframes. The engine tracks per-rule and per-keyframe props separately (so a
 * scoped rule's variables land on its target); this whole-definition view is
 * kept for callers that want the full set.
 */
export function distinctStateProps(definition: IStyleDefinition): string[] {
  const props = new Set<string>()

  for (const declarations of Object.values(definition.rules)) {
    for (const prop of declarationStateProps(declarations)) {
      props.add(prop)
    }
  }

  for (const frames of Object.values(definition.keyframes ?? {})) {
    for (const declarations of Object.values(frames)) {
      for (const prop of declarationStateProps(declarations)) {
        props.add(prop)
      }
    }
  }

  return [...props]
}
