import fs from "node:fs"
import path from "node:path"
import { META_CONDITION } from "@heleonix/hx-language"
import type { IMetaDocument } from "@heleonix/hx-language"
import { TypeResolver, createNodeTypeProgramHost } from "@heleonix/hx-analyzer"

// Media and Pseudo are written in native CSS spelling (`@media`, `:hover`), never
// as `@hx-*` rules, so the manifest must not offer them to editors.
const NATIVELY_SPELLED = new Set(["Media", "Pseudo"])

const coreDir = path.resolve(process.cwd(), "../../runtime/hx-core")

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(coreDir, file), "utf8")) as T
}

describe("hx-core's shipped hx.meta.json", () => {
  const pkg = readJson<{
    name: string
    version: string
    files: string[]
    exports: Record<string, Record<string, string>>
  }>("package.json")
  const meta = readJson<IMetaDocument>("hx.meta.json")

  it("then carries exactly the qualifier contracts its TypeScript classes declare", () => {
    const resolver = new TypeResolver(createNodeTypeProgramHost(coreDir))

    resolver.discover()

    const expected = resolver
      .qualifiers()
      .filter((qualifier) => !NATIVELY_SPELLED.has(qualifier.name))
      .map((qualifier) => ({ name: qualifier.name, args: qualifier.args }))
      .sort((a, b) => a.name.localeCompare(b.name))

    expect(meta.qualifiers)
      .withContext(`regenerate runtime/hx-core/hx.meta.json "qualifiers" as:\n${JSON.stringify(expected, null, 2)}`)
      .toEqual(expected)
  })

  it("then names its package and version", () => {
    expect(meta.package).toBe(pkg.name)
    expect(meta.version).toBe(pkg.version)
  })

  it("then is published under the hxmeta export condition", () => {
    expect(pkg.exports["."][META_CONDITION]).toBe("./hx.meta.json")
    expect(pkg.files).toContain("hx.meta.json")
  })
})
