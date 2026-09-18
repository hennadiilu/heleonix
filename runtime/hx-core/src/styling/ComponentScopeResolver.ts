import { Component } from "../components/Component"
import { IStyleScopeResolver } from "./IStyleScopeResolver"

const SEGMENT_SEPARATOR = "."

export class ComponentScopeResolver implements IStyleScopeResolver {
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

export const componentScopeResolver = new ComponentScopeResolver()

function collectNamed(node: Component, name: string, out: Component[]): void {
  for (const child of node.children) {
    if (child.usage.name === name) {
      out.push(child)
    }

    collectNamed(child, name, out)
  }
}
