import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { AnalyzerHost } from "../src/analysis/AnalyzerHost"
import { PackageGraph } from "../src/packages/PackageGraph"

// `web` depends on `@acme/ui` and lists `@acme/kit` as a dev dependency; `ui`
// peer-depends on `@acme/core`, whose dev dependency `@acme/tools` is tooling;
// `@acme/linked` lives outside the workspace and is linked into `web`.
function createWorkspace(): { root: string; outside: string } {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-package-graph-")))
  const root = path.join(base, "repo")
  const outside = path.join(base, "linked")

  const write = (file: string, content: unknown): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(content))
  }

  write(path.join(root, "package.json"), { name: "repo" })
  write(path.join(root, "apps/web/package.json"), {
    name: "web",
    dependencies: { "@acme/ui": "workspace:*", "@acme/linked": "workspace:*", lodash: "4.0.0" },
    devDependencies: { "@acme/kit": "workspace:*" },
  })
  write(path.join(root, "packages/ui/package.json"), { name: "@acme/ui", peerDependencies: { "@acme/core": "*" } })
  write(path.join(root, "packages/core/package.json"), {
    name: "@acme/core",
    dependencies: { "@acme/ui": "*" },
    devDependencies: { "@acme/tools": "*" },
  })
  write(path.join(root, "packages/kit/package.json"), { name: "@acme/kit" })
  write(path.join(root, "packages/tools/package.json"), { name: "@acme/tools" })
  write(path.join(outside, "package.json"), { name: "@acme/linked" })
  fs.mkdirSync(path.join(root, "apps/web/node_modules/@acme"), { recursive: true })
  fs.symlinkSync(outside, path.join(root, "apps/web/node_modules/@acme/linked"), "junction")

  return { root, outside }
}

describe("PackageGraph", () => {
  const { root, outside } = createWorkspace()
  const dirs = ["", "apps/web", "packages/ui", "packages/core", "packages/kit", "packages/tools"].map((dir) =>
    path.join(root, dir),
  )
  const graph = new PackageGraph([root], dirs, false)
  const names = (filePath: string, from = graph): (string | undefined)[] =>
    from.scopeOf(filePath).packages.map((node) => node.name)

  afterAll(() => {
    fs.rmSync(path.dirname(root), { recursive: true, force: true })
  })

  it("then gives a file to the deepest package holding it", () => {
    expect(graph.ownerOf(path.join(root, "apps", "web", "src", "Card.hxs"))?.name).toBe("web")
    expect(graph.ownerOf(path.join(root, "tools", "build.ts"))?.name).toBe("repo")
  })

  it("then scopes a package to itself and its dependencies, dev tooling only of its own", () => {
    expect(names(path.join(root, "apps", "web", "a.hxm"))).toEqual(["web", "@acme/ui", "@acme/kit", "@acme/core"])
    expect(names(path.join(root, "packages", "ui", "a.hxm"))).toEqual(["@acme/ui", "@acme/core"])
  })

  it("then lets a scope contain only its own packages' files", () => {
    const scope = graph.scopeOf(path.join(root, "packages", "ui", "a.hxm"))

    expect(scope.contains(path.join(root, "packages", "core", "src", "b.hxs"))).toBeTrue()
    expect(scope.contains(path.join(root, "apps", "web", "src", "c.hxs"))).toBeFalse()
  })

  it("then follows a package linked in from outside the workspace only when asked", () => {
    const linked = new PackageGraph([root], dirs, true)

    expect(names(path.join(root, "apps", "web", "a.hxm"), linked)).toContain("@acme/linked")
    expect(linked.externalPackages().map((node) => node.dir)).toEqual([outside])
    expect(linked.scopeOf(path.join(outside, "src", "Badge.hxs")).key).toBe(outside)
    expect(graph.externalPackages()).toEqual([])
  })

  it("then tells whether a package is or reaches another, through dependencies here", () => {
    const node = (dir: string) => graph.ownerOf(path.join(root, dir, "package.json"))!

    expect(graph.reaches(node("packages/ui"), "@acme/core")).toBeTrue()
    expect(graph.reaches(node("packages/kit"), "@acme/kit")).toBeTrue()
    expect(graph.reaches(node("apps/web"), "@acme/tools")).toBeTrue()
    expect(graph.reaches(node("packages/kit"), "@acme/core")).toBeFalse()
  })

  it("then gives a root opened inside a package to that package", () => {
    const opened = new PackageGraph([path.join(root, "apps", "web", "src")], [], false)

    expect(names(path.join(root, "apps", "web", "src", "Card.hxs"), opened)).toEqual(["web"])
  })

  it("then sees the whole workspace from a file no package holds", () => {
    const loose = new PackageGraph([], dirs.slice(1), false)
    const scope = loose.scopeOf(path.join(root, "docs", "Notes.hxd"))

    expect(scope.key).toBe("")
    expect(scope.contains(path.join(root, "apps", "web", "src", "c.hxs"))).toBeTrue()
  })
})

describe("AnalyzerHost finding a workspace's packages", () => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-workspace-packages-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  beforeAll(() => {
    write("package.json", { name: "mono", private: true })
    write("packages/ui/package.json", { name: "@acme/ui" })
    write("packages/ui/test/fixture/package.json", { name: "fixture" })
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const ownerOf = (file: string): string => {
    const host = new AnalyzerHost()

    host.seed([root], new Set(["node_modules"]))

    return host.packageScope(path.join(root, file)).key
  }

  it("then takes every folder holding a package.json without a workspace manifest", () => {
    expect(ownerOf("packages/ui/test/fixture/Fake.hxd")).toBe(path.join(root, "packages", "ui", "test", "fixture"))
  })

  it("then takes only the packages a workspace manifest declares", () => {
    write("pnpm-workspace.yaml", `packages:\n  - "packages/*"\n`)

    try {
      expect(ownerOf("packages/ui/test/fixture/Fake.hxd")).toBe(path.join(root, "packages", "ui"))
    } finally {
      fs.rmSync(path.join(root, "pnpm-workspace.yaml"))
    }
  })
})
