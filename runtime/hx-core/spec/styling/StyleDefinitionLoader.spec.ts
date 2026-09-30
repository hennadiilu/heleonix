import { DefinitionSource, StyleDefinitionLoader } from "@heleonix/hx-core"
import { DimensionManager } from "../../src/dimensions/DimensionManager"
import type { IDimension, IStyleDefinition } from "@heleonix/hx-language"

class SourceA extends DefinitionSource<IStyleDefinition> {
  public async loadDefinitions(name: string, _dimension: IDimension): Promise<readonly IStyleDefinition[]> {
    return name === "Button" ? [{ name, dimension: {}, rules: { "": { color: "red" } } }] : []
  }
}

class SourceB extends DefinitionSource<IStyleDefinition> {
  public async loadDefinitions(name: string, _dimension: IDimension): Promise<readonly IStyleDefinition[]> {
    return name === "Button"
      ? [{ name, dimension: {}, rules: { "": { padding: "4px" }, Hover: { color: "blue" } } }]
      : []
  }
}

function loaderWith(sources: (new () => DefinitionSource<IStyleDefinition>)[]): StyleDefinitionLoader {
  return new StyleDefinitionLoader(
    new DimensionManager([]),
    sources.map((Source) => new Source()),
  )
}

describe("StyleDefinitionLoader", () => {
  it("then merges a component's definitions across sources per-declaration", async () => {
    const definition = await loaderWith([SourceA, SourceB]).loadDefinition("Button")

    expect(definition?.rules).toEqual({ "": { color: "red", padding: "4px" }, Hover: { color: "blue" } })
  })

  it("then returns undefined for a component with no definitions", async () => {
    expect(await loaderWith([SourceA, SourceB]).loadDefinition("Missing")).toBeUndefined()
  })

  it("then caches the merged result per name and dimension", async () => {
    const loader = loaderWith([SourceA, SourceB])

    expect(await loader.loadDefinition("Button")).toBe(await loader.loadDefinition("Button"))
  })
})
