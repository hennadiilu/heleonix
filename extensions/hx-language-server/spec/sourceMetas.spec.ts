import type { IMetaDocument } from "@heleonix/hx-language"
import { normalizeCompiledDefinitions, mergeCompiledDefinitions } from "../src/transports/normalizeCompiledDefinitions"

describe("normalizeCompiledDefinitions (metas)", () => {
  it("then keeps well-formed meta manifests and drops the rest", () => {
    const result = normalizeCompiledDefinitions({ metas: [{ schemaVersion: 1 }, "junk"], nonsense: 1 })

    expect(result.metas).toEqual([{ schemaVersion: 1 } as IMetaDocument])
  })

  it("then yields no metas when the manifest carries none", () => {
    expect(normalizeCompiledDefinitions({ components: [{ name: "X" }] }).metas).toEqual([])
    expect(normalizeCompiledDefinitions(undefined).metas).toEqual([])
  })

  it("then accepts a bare hx.meta.json (top-level schemaVersion) as one meta, not an envelope", () => {
    const manifest = {
      schemaVersion: 1,
      package: "@acme/ui",
      // IMetaDocument.components are IComponentMetaEntry[], NOT compiled I*Definition entries
      components: [{ name: "Button", dimension: {}, props: [] }],
      converters: [{ name: "Truncate", params: [] }],
      actions: [{ name: "Submit", params: [] }],
      docs: [{ kind: "component", name: "Button", dimension: {}, docs: {} }],
    }

    const result = normalizeCompiledDefinitions(manifest)

    expect(result.metas).toEqual([manifest as unknown as IMetaDocument])
    // the manifest's meta-shaped components are not mis-collected as compiled definitions
    expect(result.components).toEqual([])
    // its docs still surface to the index
    expect(result.docs.length).toBe(1)
  })

  it("then merges metas from several manifests (directory sources)", () => {
    const merged = normalizeCompiledDefinitions({ metas: [{ schemaVersion: 1, package: "a" }] })

    mergeCompiledDefinitions(merged, normalizeCompiledDefinitions({ metas: [{ schemaVersion: 1, package: "b" }] }))

    expect(merged.metas.map((m) => m.package)).toEqual(["a", "b"])
  })
})
