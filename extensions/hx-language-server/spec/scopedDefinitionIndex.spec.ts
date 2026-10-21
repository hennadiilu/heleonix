import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { DefinitionRegistry } from "../src/sources/DefinitionRegistry"
import { WorkspaceDefinitionSource } from "../src/sources/WorkspaceDefinitionSource"
import { PackageGraph } from "../src/packages/PackageGraph"

// `web` depends on the library `@acme/ui` and references its dictionary;
// `admin` depends on nothing.
describe("DefinitionRegistry scoped by package", () => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-scoped-index-")))
  const dirs = ["apps/web", "apps/admin", "packages/ui"].map((dir) => path.join(root, dir))
  const registry = new DefinitionRegistry()
  let graph: PackageGraph

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  beforeAll(async () => {
    write("apps/web/package.json", { name: "web", dependencies: { "@acme/ui": "workspace:*" } })
    write("apps/web/src/Buttons.hxd", `{ "save": "Save" }`)
    write("apps/web/src/Page.hxm", `<Component><span>{@Labels.title}</span><Badge /></Component>`)
    write("apps/admin/package.json", { name: "admin" })
    write("apps/admin/src/Audit.hxd", `{ "log": "Log" }`)
    write("packages/ui/package.json", { name: "@acme/ui" })
    write("packages/ui/src/Labels.hxd", `{ "title": "Title" }`)
    write("packages/ui/src/Badge.hxm", `<Component><span /></Component>`)

    graph = new PackageGraph([root], dirs, false)
    registry.register(new WorkspaceDefinitionSource([root], new Set(["node_modules"])))
    await registry.rebuild()
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const indexOf = (dir: string) => registry.getIndex(graph.scopeOf(path.join(root, dir, "src", "Any.hxm")))

  it("then shows a package the definitions of itself and its dependencies only", () => {
    expect(indexOf("apps/web").names("dictionary")).toEqual(["Buttons", "Labels"])
    expect(indexOf("apps/web").componentTags()).toEqual(["Badge", "Page"])
    expect(indexOf("packages/ui").names("dictionary")).toEqual(["Labels"])
    expect(indexOf("apps/admin").names("dictionary")).toEqual(["Audit"])
  })

  it("then answers usage across the workspace, where a library's users live", () => {
    expect(indexOf("packages/ui").isEntryUsed("dictionary", "Labels", "title")).toBeTrue()
    expect(indexOf("packages/ui").entryReferrers("dictionary", "Labels", "title")).toEqual(["Page"])
  })

  it("then shows the whole workspace from a file no package holds", () => {
    expect(registry.getIndex(graph.scopeOf(path.join(root, "Notes.hxd"))).names("dictionary")).toEqual([
      "Audit",
      "Buttons",
      "Labels",
    ])
  })
})
