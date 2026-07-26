import { ComponentScopeResolver } from "@heleonix/hx-core"
import type { Component } from "@heleonix/hx-core"

interface FakeNode {
  usage: { name?: string }
  children: FakeNode[]
}

function node(name: string | undefined, children: FakeNode[] = []): FakeNode {
  return { usage: { name }, children }
}

function resolve(root: FakeNode, path: string): readonly Component[] {
  return new ComponentScopeResolver().resolve(root as unknown as Component, path)
}

describe("ComponentScopeResolver", () => {
  it("then resolves a nested control path, searching through anonymous wrappers", () => {
    const item = node("item")
    const menu = node("menu", [item])
    const head = node("head", [node(undefined, [menu])])
    const root = node(undefined, [node(undefined, [head])])

    expect(resolve(root, "head.menu.item")).toEqual([item as unknown as Component])
  })

  it("then returns every match of the final segment (a repeated control name)", () => {
    const first = node("item")
    const second = node("item")
    const root = node(undefined, [node("list", [first, second])])

    expect(resolve(root, "list.item")).toEqual([first, second] as unknown as Component[])
  })

  it("then returns an empty list when a segment is missing", () => {
    const root = node(undefined, [node("head")])

    expect(resolve(root, "head.nope")).toEqual([])
  })
})
