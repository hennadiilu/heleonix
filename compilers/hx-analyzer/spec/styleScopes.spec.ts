import { Analyzer } from "@heleonix/hx-analyzer"
import { EXT_STYLE, EXT_TEMPLATE } from "@heleonix/hx-language"

const card = {
  path: "/src/Card.hxm",
  ext: EXT_TEMPLATE,
  name: "Card",
  dimension: {},
  source: `<Component>
  <div name="head">
    <div name="menu"><span name="item">x</span></div>
  </div>
</Component>`,
}

function analyzerWith(
  ...files: { path: string; ext: string; name: string; dimension: {}; source: string }[]
): Analyzer {
  const analyzer = new Analyzer()

  analyzer.addMeta({
    schemaVersion: 1,
    components: ["div", "span"].map((name) => ({ name, dimension: {}, open: true })),
  })

  for (const file of files) {
    analyzer.setFile(file)
  }

  return analyzer
}

function style(source: string): { path: string; ext: string; name: string; dimension: {}; source: string } {
  return { path: "/src/Card.hxs", ext: EXT_STYLE, name: "Card", dimension: {}, source }
}

describe("Analyzer @hx-style(for:) scope validation (0006)", () => {
  describe("given control-name and base-type scope paths", () => {
    it("then resolves them with no diagnostics", async () => {
      const result = await analyzerWith(
        card,
        style(`@hx-style(for: head.menu.item) { color: red; }\n@hx-style(for: Component) { color: blue; }`),
      ).analyze()

      expect(result).toEqual([])
    })
  })

  describe("given a bogus single segment", () => {
    it("then reports the unknown scope segment", async () => {
      const result = await analyzerWith(card, style(`@hx-style(for: bogus) { color: red; }`)).analyze()

      expect(result).toEqual([
        jasmine.objectContaining({ code: "HX_ANALYZER_0006", subject: "bogus", file: "/src/Card.hxs" }),
      ])
    })
  })

  describe("given a valid prefix then a bogus segment", () => {
    it("then reports only the bogus segment", async () => {
      const result = await analyzerWith(card, style(`@hx-style(for: head.nope) { color: red; }`)).analyze()

      expect(result.filter((d) => d.code === "HX_ANALYZER_0006").map((d) => d.subject)).toEqual(["nope"])
    })
  })

  describe("given a known component type segment", () => {
    it("then accepts it (is-a safe) even without a matching child", async () => {
      const analyzer = analyzerWith(card, style(`@hx-style(for: Widget) { color: red; }`))
      analyzer.addMeta({ schemaVersion: 1, components: [{ name: "Widget", dimension: {} }] })

      expect(await analyzer.analyze()).toEqual([])
    })
  })

  describe("controlNames() accessor", () => {
    it("then exposes a component's workspace control tree", async () => {
      const analyzer = analyzerWith(card)
      await analyzer.analyze()

      const controls = [...(analyzer.controlNames().get("Card") ?? [])]

      expect(controls).toContain("head")
      expect(controls).toContain("menu")
      expect(controls).toContain("item")
    })

    it("then includes controls delivered by dependency meta", async () => {
      const analyzer = analyzerWith()
      analyzer.addMeta({ schemaVersion: 1, components: [{ name: "Panel", dimension: {}, controls: ["body"] }] })
      await analyzer.analyze()

      expect(analyzer.controlNames().get("Panel")).toEqual(["body"])
    })
  })

  describe("given a style whose component has no workspace definition", () => {
    const orphan = {
      path: "/src/Orphan.hxs",
      ext: EXT_STYLE,
      name: "Orphan",
      dimension: {},
      source: `@hx-style(for: whatever) { color: red; }`,
    }

    it("then validates once its controls arrive via a dependency's meta", async () => {
      const analyzer = analyzerWith(orphan)
      analyzer.addMeta({ schemaVersion: 1, components: [{ name: "Orphan", dimension: {}, controls: ["whatever"] }] })

      expect(await analyzer.analyze()).toEqual([])

      const bogus = { ...orphan, source: `@hx-style(for: nope) { color: red; }` }
      const analyzer2 = analyzerWith(bogus)
      analyzer2.addMeta({ schemaVersion: 1, components: [{ name: "Orphan", dimension: {}, controls: ["whatever"] }] })

      expect((await analyzer2.analyze()).map((d) => d.subject)).toEqual(["nope"])
    })

    it("then skips scope validation without any control data (no false positive)", async () => {
      expect(await analyzerWith(orphan).analyze()).toEqual([])
    })
  })
})
