import { ComponentDefinitionLoader, DefinitionSelectionStrategy, DefinitionSource } from "@heleonix/hx-core"
import { DimensionManager } from "../../src/dimensions/DimensionManager"
import type { IComponentDefinition, IDimension } from "@heleonix/hx-language"

class ComponentSource extends DefinitionSource<IComponentDefinition> {
  public loads = 0

  public constructor(private readonly components: readonly IComponentDefinition[]) {
    super()
  }

  public loadDefinitions(name: string): Promise<readonly IComponentDefinition[]> {
    this.loads++

    return Promise.resolve(this.components.filter((component) => component.tag === name))
  }
}

const button = (type: string, dimension: IDimension = {}): IComponentDefinition => ({ tag: "Button", type, dimension })

function loaderWith(
  sources: readonly ComponentSource[],
  selectionStrategy?: DefinitionSelectionStrategy,
): ComponentDefinitionLoader {
  const dimensions = new DimensionManager([{ name: "culture", values: ["en-US", "uk-UA"] }])

  dimensions.update({ culture: "uk-UA" })

  return new ComponentDefinitionLoader(dimensions, sources, selectionStrategy)
}

describe("ComponentDefinitionLoader", () => {
  describe("given layered sources", () => {
    it("then selects the most specific match of the topmost matching source", async () => {
      const definition = await loaderWith([
        new ComponentSource([button("Package")]),
        new ComponentSource([button("App"), button("AppUk", { culture: "uk-UA" })]),
      ]).loadDefinition("Button")

      expect(definition?.type).toBe("AppUk")
    })

    it("then never loads the sources below the topmost matching one", async () => {
      const lower = new ComponentSource([button("Package")])

      await loaderWith([lower, new ComponentSource([button("App")])]).loadDefinition("Button")

      expect(lower.loads).toBe(0)
    })

    it("then falls through a source whose definitions do not match the current dimension", async () => {
      const definition = await loaderWith([
        new ComponentSource([button("Package")]),
        new ComponentSource([button("AppEn", { culture: "en-US" })]),
      ]).loadDefinition("Button")

      expect(definition?.type).toBe("Package")
    })

    it("then returns undefined for a component no source defines", async () => {
      expect(await loaderWith([new ComponentSource([button("App")])]).loadDefinition("Missing")).toBeUndefined()
    })

    it("then keeps the first of equally specific matches within a source", async () => {
      const definition = await loaderWith([
        new ComponentSource([button("First", { culture: "uk-UA" }), button("Second", { culture: "uk-UA" })]),
      ]).loadDefinition("Button")

      expect(definition?.type).toBe("First")
    })
  })

  describe("given the All strategy and equally specific matches in several sources", () => {
    it("then keeps the earlier-registered source's match", async () => {
      const definition = await loaderWith(
        [new ComponentSource([button("Package")]), new ComponentSource([button("App")])],
        DefinitionSelectionStrategy.All,
      ).loadDefinition("Button")

      expect(definition?.type).toBe("Package")
    })

    it("then still prefers a more specific match from a later source", async () => {
      const definition = await loaderWith(
        [new ComponentSource([button("Package")]), new ComponentSource([button("AppUk", { culture: "uk-UA" })])],
        DefinitionSelectionStrategy.All,
      ).loadDefinition("Button")

      expect(definition?.type).toBe("AppUk")
    })
  })
})
