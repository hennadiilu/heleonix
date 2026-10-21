import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { AnalyzerHost } from "../src/analysis/AnalyzerHost"

// A monorepo whose root lists no dependencies: `web` installs `@acme/material`
// (shipping a manifest) and links the workspace's own `@acme/ui`, whose last
// build left a manifest behind; `admin` installs the same `@acme/material`.
function createMonorepo(): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-dependency-metas-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  const material = (dir: string): void => {
    write(`${dir}/node_modules/@acme/material/package.json`, {
      name: "@acme/material",
      exports: { ".": { hxmeta: "./hx.meta.json" } },
    })
    write(`${dir}/node_modules/@acme/material/hx.meta.json`, {
      schemaVersion: 1,
      package: "@acme/material",
      version: "1.0.0",
      converters: [{ name: "Material", params: [] }],
      themeTokens: { "Material.gap": "8px" },
    })
  }

  write("package.json", { name: "mono", private: true })
  write("apps/web/package.json", {
    name: "web",
    dependencies: { "@acme/material": "1.0.0", "@acme/ui": "workspace:*" },
  })
  write("apps/web/src/Card.hxs", "color: red;\n")
  material("apps/web")
  write("apps/admin/package.json", { name: "admin", dependencies: { "@acme/material": "1.0.0" } })
  material("apps/admin")
  write("packages/ui/package.json", { name: "@acme/ui", exports: { ".": { hxmeta: "./hx.meta.json" } } })
  write("packages/ui/hx.meta.json", {
    schemaVersion: 1,
    package: "@acme/ui",
    converters: [{ name: "Stale", params: [] }],
    themeTokens: { "Ui.gap": "4px" },
  })

  fs.mkdirSync(path.join(root, "apps/web/node_modules/@acme"), { recursive: true })
  fs.symlinkSync(path.join(root, "packages/ui"), path.join(root, "apps/web/node_modules/@acme/ui"), "junction")

  return root
}

describe("AnalyzerHost reading dependency metadata in a monorepo", () => {
  const root = createMonorepo()
  const webFile = path.join(root, "apps", "web", "src", "Card.hxs")

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  function seeded(folder: string): AnalyzerHost {
    const host = new AnalyzerHost()

    host.seed([folder], new Set(["node_modules"]))

    return host
  }

  it("then reads what a package installs into that package's scope, not into others'", async () => {
    const host = seeded(root)
    const web = await host.snapshot(webFile)

    expect(web.converters.map((found) => found.name)).toEqual(["Material"])
    expect(web.themeTokens.get("Material.gap")).toBe("8px")
    expect((await host.snapshot(path.join(root, "packages", "ui", "Tokens.hxt"))).converters).toEqual([])
  })

  it("then ignores the manifest of a package whose sources are inside the workspace", async () => {
    const web = await seeded(root).snapshot(webFile)

    expect(web.converters.map((found) => found.name)).not.toContain("Stale")
    expect(web.themeTokens.has("Ui.gap")).toBeFalse()
  })

  it("then reads the dependencies of the package owning an opened source folder", async () => {
    const web = await seeded(path.join(root, "apps", "web", "src")).snapshot(webFile)

    expect(web.converters.map((found) => found.name)).toEqual(["Material", "Stale"])
  })
})
