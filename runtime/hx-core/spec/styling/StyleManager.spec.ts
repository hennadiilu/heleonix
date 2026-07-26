import { DIContainer, DimensionManager, FrameworkElement, PlatformAdapter, StyleManager } from "@heleonix/hx-core"
import type { Component, StyleEffect, StyleEnginePlatform, StyleHandle } from "@heleonix/hx-core"
import { stringifyRuleKey } from "@heleonix/hx-language"
import type { IStyleDefinition, IThemeDefinition } from "@heleonix/hx-language"

const SCOPE_KEY = stringifyRuleKey([{ name: "Style", args: { for: "body" } }])

class FakeEffect implements StyleEffect {
  public readonly classesSet: StyleHandle[] = []
  public readonly classesRemoved: StyleHandle[] = []
  public setAttribute(): void {}
  public removeAttribute(): void {}
  public setVariable(): void {}
  public removeVariable(): void {}
  public setClass(handle: StyleHandle): void {
    this.classesSet.push(handle)
  }
  public removeClass(handle: StyleHandle): void {
    this.classesRemoved.push(handle)
  }
  public setProperty(): void {}
  public removeProperty(): void {}
}

class FakePlatformAdapter extends PlatformAdapter {
  public readonly composed: string[] = []
  public readonly effect = new FakeEffect()

  public static override get diName(): string {
    return "PlatformAdapter"
  }

  public scheduleTask(callback: () => void): void {
    callback()
  }

  public getRootHost(): null {
    return null
  }

  public readonly composedDecls: Record<string, string>[] = []

  public get styleEnginePlatform(): StyleEnginePlatform<Component> {
    return {
      compose: (signature: string, _fragments, declarations): StyleHandle => {
        this.composed.push(signature)
        this.composedDecls.push({ ...declarations })

        return { signature } as unknown as StyleHandle
      },
      release: () => {},
      effectFor: () => this.effect,
    }
  }

  public applyThemeTokens(): void {}

  public applyThemeArtifacts(): void {}
}

class FakeStateManager extends FrameworkElement {
  public readonly changed = { on: () => {}, off: () => {} }

  public static get diName(): string {
    return "StateManager"
  }

  public getValue(): unknown {
    return undefined
  }
}

class FakeComponentManager extends FrameworkElement {
  public builtHandler?: (fq: string, instance: Component) => void
  public destroyedHandler?: (fq: string, instance: Component) => void

  public readonly componentBuilt = {
    on: (handler: (fq: string, instance: Component) => void) => {
      this.builtHandler = handler
    },
    off: () => {},
  }

  public readonly componentDestroyed = {
    on: (handler: (fq: string, instance: Component) => void) => {
      this.destroyedHandler = handler
    },
    off: () => {},
  }

  public static get diName(): string {
    return "ComponentManager"
  }
}

class FakeProvider extends FrameworkElement {
  public static get diName(): string {
    return "StyleDefinitionProvider"
  }

  public async getDefinition(tag: string): Promise<IStyleDefinition | undefined> {
    if (tag === "Button") {
      return { name: tag, dimension: {}, rules: { "": { color: "red" } } }
    }

    if (tag === "Applied") {
      return { name: tag, dimension: {}, rules: { "": { color: "red" } }, applies: { "": ["Typography.Heading"] } }
    }

    if (tag === "Scoped") {
      return { name: tag, dimension: {}, rules: { [SCOPE_KEY]: { color: "red" } } }
    }

    return undefined
  }
}

class FakeThemeProvider extends FrameworkElement {
  public groups: IThemeDefinition["groups"] = { Typography: { Heading: { "font-size": "2rem", color: "blue" } } }

  public static get diName(): string {
    return "ThemeDefinitionProvider"
  }

  public async getTheme(): Promise<IThemeDefinition> {
    return { name: "", dimension: {}, groups: this.groups }
  }
}

function componentOf(tag: string): Component {
  return { definition: { tag } } as unknown as Component
}

interface FakeComponent {
  definition: { tag: string }
  usage: { name?: string }
  children: FakeComponent[]
  parent?: FakeComponent
}

function componentTree(tag: string, name?: string, parent?: FakeComponent): FakeComponent {
  const component: FakeComponent = { definition: { tag }, usage: { name }, children: [], parent }

  parent?.children.push(component)

  return component
}

function built(manager: StyleManager, component: FakeComponent): Promise<void> {
  return (manager as unknown as { onComponentBuilt(c: Component): Promise<void> }).onComponentBuilt(
    component as unknown as Component,
  )
}

function managerWith(): {
  manager: StyleManager
  adapter: FakePlatformAdapter
  componentManager: FakeComponentManager
  themeProvider: FakeThemeProvider
} {
  const container = new DIContainer()

  container.registerInjectables([
    StyleManager,
    DimensionManager,
    FakePlatformAdapter,
    FakeStateManager,
    FakeComponentManager,
    FakeProvider,
    FakeThemeProvider,
  ] as never[])
  container.registerSettings("DimensionManager", { dimensions: [] })

  return {
    manager: container.inject<StyleManager>("StyleManager"),
    adapter: container.inject<FakePlatformAdapter>("PlatformAdapter"),
    componentManager: container.inject<FakeComponentManager>("ComponentManager"),
    themeProvider: container.inject<FakeThemeProvider>("ThemeDefinitionProvider"),
  }
}

describe("StyleManager", () => {
  it("then applies a component's resolved style through the platform's engine", async () => {
    const { manager, adapter } = managerWith()

    await manager.apply(componentOf("Button"))

    expect(adapter.composed).toEqual([""])
    expect(adapter.effect.classesSet.length).toBe(1)
  })

  it("then removes the styling on teardown", async () => {
    const { manager, adapter } = managerWith()
    const component = componentOf("Button")

    await manager.apply(component)
    manager.remove(component)

    expect(adapter.effect.classesRemoved.length).toBe(1)
  })

  it("then does nothing for a component with no style definition", async () => {
    const { manager, adapter } = managerWith()

    await manager.apply(componentOf("Plain"))

    expect(adapter.composed).toEqual([])
  })

  it("then expands @hx-apply groups against the theme, with explicit declarations winning", async () => {
    const { manager, adapter } = managerWith()

    await manager.apply(componentOf("Applied"))

    expect(adapter.composedDecls).toEqual([{ "font-size": "2rem", color: "red" }])
  })

  it("then re-expands @hx-apply against the current theme when re-applied (brand overlay switch)", async () => {
    const { manager, adapter, themeProvider } = managerWith()
    const component = componentOf("Applied")

    await manager.apply(component)
    expect(adapter.composedDecls.at(-1)).toEqual({ "font-size": "2rem", color: "red" })

    themeProvider.groups = { Typography: { Heading: { "font-size": "3rem", color: "blue" } } }
    await manager.apply(component)

    expect(adapter.composedDecls.at(-1)).toEqual({ "font-size": "3rem", color: "red" })
  })

  it("then styles a component the ComponentManager reports built and tears it down on destroy", async () => {
    const { manager, componentManager } = managerWith()
    const component = componentOf("Button")
    const applySpy = spyOn(manager, "apply").and.resolveTo()
    const removeSpy = spyOn(manager, "remove")

    await built(manager, component as unknown as FakeComponent)
    componentManager.destroyedHandler!("Button/1", component)

    expect(applySpy).toHaveBeenCalledWith(component)
    expect(removeSpy).toHaveBeenCalledWith(component)
  })

  it("then re-styles a scoped ancestor when a descendant is built later", async () => {
    const { manager } = managerWith()
    const parent = componentTree("Scoped")

    await manager.apply(parent as unknown as Component)

    const applySpy = spyOn(manager, "apply").and.resolveTo()
    const child = componentTree("Child", "body", parent)

    await built(manager, child)

    expect(applySpy).toHaveBeenCalledWith(child as unknown as Component)
    expect(applySpy).toHaveBeenCalledWith(parent as unknown as Component)
  })

  it("then composes the ancestor's scoped rule only once the matching descendant exists", async () => {
    const { manager, adapter } = managerWith()
    const parent = componentTree("Scoped")

    await manager.apply(parent as unknown as Component)
    expect(adapter.composed).toEqual([])

    const child = componentTree("Child", "body", parent)
    await built(manager, child)

    expect(adapter.composed).toContain(SCOPE_KEY)
  })

  it("then does not re-style an unscoped ancestor when a descendant is built", async () => {
    const { manager } = managerWith()
    const parent = componentTree("Button")

    await manager.apply(parent as unknown as Component)

    const applySpy = spyOn(manager, "apply").and.resolveTo()
    const child = componentTree("Child", "body", parent)

    await built(manager, child)

    expect(applySpy).not.toHaveBeenCalledWith(parent as unknown as Component)
  })
})
