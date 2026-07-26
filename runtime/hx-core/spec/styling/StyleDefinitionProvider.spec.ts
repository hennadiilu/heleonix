import { DIContainer, DimensionManager, StyleDefinitionProvider, StyleDefinitionSource } from "@heleonix/hx-core"
import type { IDimension, IStyleDefinition } from "@heleonix/hx-language"

class SourceA extends StyleDefinitionSource {
  public static get diName(): string {
    return "SourceA"
  }

  public async getDefinitions(name: string, _dimension: IDimension): Promise<readonly IStyleDefinition[]> {
    return name === "Button" ? [{ name, dimension: {}, rules: { "": { color: "red" } } }] : []
  }
}

class SourceB extends StyleDefinitionSource {
  public static get diName(): string {
    return "SourceB"
  }

  public async getDefinitions(name: string, _dimension: IDimension): Promise<readonly IStyleDefinition[]> {
    return name === "Button"
      ? [{ name, dimension: {}, rules: { "": { padding: "4px" }, Hover: { color: "blue" } } }]
      : []
  }
}

function providerWith(sources: unknown[]): StyleDefinitionProvider {
  const container = new DIContainer()

  container.registerInjectables([DimensionManager, StyleDefinitionProvider, SourceA, SourceB] as never[])
  container.registerSettings("DimensionManager", { dimensions: [] })
  container.registerSettings("StyleDefinitionProvider", { sources })

  return container.inject<StyleDefinitionProvider>("StyleDefinitionProvider")
}

describe("StyleDefinitionProvider", () => {
  it("then merges a component's definitions across sources per-declaration", async () => {
    const definition = await providerWith([SourceA, SourceB]).getDefinition("Button")

    expect(definition?.rules).toEqual({ "": { color: "red", padding: "4px" }, Hover: { color: "blue" } })
  })

  it("then returns undefined for a component with no definitions", async () => {
    expect(await providerWith([SourceA, SourceB]).getDefinition("Missing")).toBeUndefined()
  })

  it("then caches the merged result per name and dimension", async () => {
    const provider = providerWith([SourceA, SourceB])

    expect(await provider.getDefinition("Button")).toBe(await provider.getDefinition("Button"))
  })
})
