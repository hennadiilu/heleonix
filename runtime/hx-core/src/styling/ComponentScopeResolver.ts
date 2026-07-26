import { Component } from "../components/Component"
import { StyleScopeResolver } from "./StyleScopeResolver"

const SEGMENT_SEPARATOR = "."

/**
 * Resolves a `@hx-style(for: ...)` path against the live component tree: each
 * dot-segment is a control name matched among the descendants of the previous
 * segment's matches (searching through anonymous wrapper elements), starting at
 * the styling component. The final segment's matches are the rule's targets, so
 * a repeated control name (a list) styles every instance. Resolution is over the
 * tree as it stands when the style applies; a dimension change re-resolves it.
 */
export class ComponentScopeResolver implements StyleScopeResolver<Component> {
  public resolve(component: Component, path: string): readonly Component[] {
    let current: Component[] = [component]

    for (const segment of path.split(SEGMENT_SEPARATOR)) {
      const matches: Component[] = []

      for (const node of current) {
        collectNamed(node, segment, matches)
      }

      if (matches.length === 0) {
        return []
      }

      current = matches
    }

    return current
  }
}

function collectNamed(node: Component, name: string, out: Component[]): void {
  for (const child of node.children) {
    if (child.usage.name === name) {
      out.push(child)
    }

    collectNamed(child, name, out)
  }
}
