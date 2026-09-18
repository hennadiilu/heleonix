import { Analyzer } from "@heleonix/hx-analyzer"
import { EXT_STYLE, EXT_TEMPLATE } from "@heleonix/hx-language"

// The component writes `isSaving` via an event capture, so its state pool is
// inferable (`isSaving`) without a TypeScript host.
const toggle = {
  path: "/src/Toggle.hxm",
  ext: EXT_TEMPLATE,
  name: "Toggle",
  dimension: {},
  source: `<Component><button click.type={isSaving} /></Component>`,
}

function analyzerWith(
  ...files: { path: string; ext: string; name: string; dimension: {}; source: string }[]
): Analyzer {
  const analyzer = new Analyzer()

  analyzer.addMeta({ schemaVersion: 1, components: [{ name: "button", dimension: {}, open: true }] })

  for (const file of files) {
    analyzer.setFile(file)
  }

  return analyzer
}

function toggleStyle(source: string): { path: string; ext: string; name: string; dimension: {}; source: string } {
  return { path: "/src/Toggle.hxs", ext: EXT_STYLE, name: "Toggle", dimension: {}, source }
}

function stateWarnings(diagnostics: { code: string; subject?: string }[]): (string | undefined)[] {
  return diagnostics.filter((d) => d.code === "HX_ANALYZER_0104").map((d) => d.subject)
}

describe("Analyzer style state reads (0104)", () => {
  describe("given an @hx-if subject in the component's pool", () => {
    it("then reports nothing", async () => {
      const result = await analyzerWith(toggle, toggleStyle(`@hx-if(value: {isSaving}) { opacity: 1; }`)).analyze()

      expect(result).toEqual([])
    })
  })

  describe("given an @hx-if subject outside the pool", () => {
    it("then warns that the state path resolves to nothing", async () => {
      const result = await analyzerWith(toggle, toggleStyle(`@hx-if(value: {typo}) { opacity: 1; }`)).analyze()

      expect(stateWarnings(result)).toEqual(["typo"])
    })
  })

  describe("given a {prop} interpolation in a declaration value", () => {
    it("then validates it against the pool", async () => {
      const ok = await analyzerWith(toggle, toggleStyle(`box-shadow: 0 {isSaving}px red;`)).analyze()
      expect(stateWarnings(ok)).toEqual([])

      const bad = await analyzerWith(toggle, toggleStyle(`box-shadow: 0 {ghost}px red;`)).analyze()
      expect(stateWarnings(bad)).toEqual(["ghost"])
    })
  })

  describe("given a style whose component has no workspace definition", () => {
    const orphan = {
      path: "/src/Orphan.hxs",
      ext: EXT_STYLE,
      name: "Orphan",
      dimension: {},
      source: `@hx-if(value: {whatever}) { opacity: 1; }`,
    }

    it("then skips state validation", async () => {
      expect(stateWarnings(await analyzerWith(orphan).analyze())).toEqual([])
    })
  })

  describe("given a component with no declared members and no self-written state", () => {
    const plain = {
      path: "/src/Plain.hxm",
      ext: EXT_TEMPLATE,
      name: "Plain",
      dimension: {},
      source: `<Component><button /></Component>`,
    }
    const plainStyle = {
      path: "/src/Plain.hxs",
      ext: EXT_STYLE,
      name: "Plain",
      dimension: {},
      source: `@hx-if(value: {anything}) { opacity: 1; }`,
    }

    it("then skips (pool not inferable, avoids guesswork)", async () => {
      expect(stateWarnings(await analyzerWith(plain, plainStyle).analyze())).toEqual([])
    })
  })
})
