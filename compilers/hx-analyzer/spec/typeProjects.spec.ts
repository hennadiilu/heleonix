import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { TypeResolver, createNodeTypeProgramHosts } from "@heleonix/hx-analyzer"

const BASES = `export abstract class Converter<TValue = unknown, TReturn = unknown, TParams = object> {
  abstract format(value: TValue, params: TParams): Promise<TReturn>
}
export abstract class StyleQualifier<TArgs = object> {
  declare protected readonly args: TArgs
}
`

// Two folders: `app`, whose solution-style config also takes in the library's
// sources, and `packages/ui` with `paths` of its own; `plain` has no config.
function createWorkspace(): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-type-projects-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  write("app/tsconfig.json", { files: [], references: [{ path: "./tsconfig.app.json" }] })
  write("app/tsconfig.app.json", { compilerOptions: { strict: true }, include: ["src", "../packages/ui/src"] })
  write("app/src/bases.ts", BASES)
  write(
    "app/src/TruncateConverter.ts",
    `import { Converter } from "./bases"
     export class TruncateConverter extends Converter<string, string, { length: number }> {
       static readonly hxName = "Truncate"
       async format(value: string) { return value }
     }`,
  )

  write("packages/ui/tsconfig.json", {
    compilerOptions: { strict: true, paths: { "#ui/*": ["./src/*"] } },
    include: ["src"],
  })
  write("packages/ui/src/bases.ts", BASES)
  write("packages/ui/src/props.ts", `export interface Props { tone: "calm" | "loud" }`)
  write(
    "packages/ui/src/IfQualifier.ts",
    `import { StyleQualifier } from "./bases"
     export class IfQualifier extends StyleQualifier<{ value: string }> {
       static readonly hxName = "If"
     }`,
  )

  write("plain/notes.txt", "")

  return root
}

describe("createNodeTypeProgramHosts", () => {
  const root = createWorkspace()

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  describe("given a solution-style tsconfig", () => {
    it("then reads the referenced projects in place of the empty solution", () => {
      const hosts = createNodeTypeProgramHosts([path.join(root, "app")])

      expect(hosts.map((host) => host.projectDir)).toEqual([path.join(root, "app")])
      expect(hosts[0].rootFiles.map((file) => path.basename(file))).toContain("TruncateConverter.ts")
    })
  })

  describe("given a folder without a tsconfig", () => {
    it("then falls back to default options there, with no project files", () => {
      const [host] = createNodeTypeProgramHosts([path.join(root, "plain")])

      expect(host.projectDir).toBe(path.join(root, "plain"))
      expect(host.rootFiles).toEqual([])
    })
  })
})

describe("TypeResolver over several projects", () => {
  const root = createWorkspace()
  const resolver = new TypeResolver(
    createNodeTypeProgramHosts([path.join(root, "app"), path.join(root, "packages", "ui")]),
  )

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then discovers the classes of every project, a file shared by two projects once", () => {
    expect(resolver.discover().map((found) => found.name)).toEqual(["Truncate"])
    expect(resolver.qualifiers().map((found) => [found.name, found.file])).toEqual([
      ["If", path.join(root, "packages", "ui", "src", "IfQualifier.ts").split(path.sep).join("/")],
    ])
  })

  it("then reports only discoverable files, never building a project none of whose files is", () => {
    const hosts = createNodeTypeProgramHosts([path.join(root, "packages", "ui"), path.join(root, "app")])
    const reads = jasmine.createSpy("reads")
    const getSourceFile = hosts[0].host.getSourceFile.bind(hosts[0].host)

    hosts[0] = {
      ...hosts[0],
      host: { ...hosts[0].host, getSourceFile: (...args) => (reads(), getSourceFile(...args)) },
    }

    const scoped = new TypeResolver(hosts, (fileName) => fileName.includes("/app/"))

    expect(scoped.discover().map((found) => found.name)).toEqual(["Truncate"])
    expect(scoped.qualifiers()).toEqual([])
    expect(reads).not.toHaveBeenCalled()
  })

  it("then resolves a type in the project owning its directory, under that project's options", () => {
    const request = { typeText: `import("#ui/props").Props` }
    const resolved = resolver.resolve([
      { id: "ui", dir: path.join(root, "packages", "ui", "src"), ...request },
      { id: "app", dir: path.join(root, "app", "src"), ...request },
    ])

    expect(resolved.get("ui")?.members.map((member) => member.name)).toEqual(["tone"])
    expect(resolved.get("app")?.resolved).toBeFalse()
  })
})

// A typical monorepo: a shared base config, an app with a solution-style config
// and a library whose config also takes in its tests; build output and installed
// packages carry configs of their own.
function createMonorepo(rootConfig?: object): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-monorepo-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  write("package.json", { name: "mono", private: true })
  write("tsconfig.base.json", { compilerOptions: { strict: true } })

  if (rootConfig) {
    write("tsconfig.json", rootConfig)
  }

  write("apps/web/package.json", { name: "web" })
  write("apps/web/tsconfig.json", { files: [], references: [{ path: "./tsconfig.app.json" }] })
  write("apps/web/tsconfig.app.json", { extends: "../../tsconfig.base.json", include: ["src"] })
  write("apps/web/src/bases.ts", BASES)
  write(
    "apps/web/src/TruncateConverter.ts",
    `import { Converter } from "./bases"
     export class TruncateConverter extends Converter<string, string> {
       static readonly hxName = "Truncate"
       async format(value: string) { return value }
     }`,
  )
  write("apps/web/node_modules/lib/tsconfig.json", { include: ["*.ts"] })

  write("packages/ui/package.json", { name: "@acme/ui" })
  write("packages/ui/tsconfig.json", {
    extends: "../../tsconfig.base.json",
    compilerOptions: { paths: { "#ui/*": ["./src/*"] } },
    include: ["src", "spec"],
  })
  write("packages/ui/src/bases.ts", BASES)
  write("packages/ui/src/props.ts", `export interface Props { tone: "calm" | "loud" }`)
  write(
    "packages/ui/src/IfQualifier.ts",
    `import { StyleQualifier } from "./bases"
     export class IfQualifier extends StyleQualifier<{ value: string }> {
       static readonly hxName = "If"
     }`,
  )
  write(
    "packages/ui/spec/FakeConverter.ts",
    `import { Converter } from "../src/bases"
     export class FakeConverter extends Converter<string, string> {
       static readonly hxName = "Fake"
       async format(value: string) { return value }
     }`,
  )
  write("packages/ui/dist/tsconfig.json", { include: ["*.ts"] })
  write("packages/ui/dist/OldConverter.ts", `export class OldConverter {}`)

  return root
}

const PROJECTS = ["**/tsconfig.json"]
const EXCLUDE_DIRS = new Set(["node_modules", "dist"])

describe("createNodeTypeProgramHosts in a monorepo whose root has no tsconfig", () => {
  const root = createMonorepo()

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reads every project the patterns find, outermost first, never in excluded folders", () => {
    const hosts = createNodeTypeProgramHosts([root], { projects: PROJECTS, excludeDirs: EXCLUDE_DIRS })

    expect(hosts.map((host) => host.projectDir)).toEqual([
      path.join(root, "apps", "web"),
      path.join(root, "packages", "ui"),
    ])
  })

  it("then discovers every package's classes, leaving out excluded files", () => {
    const hosts = (exclude: string[]): ReturnType<typeof createNodeTypeProgramHosts> =>
      createNodeTypeProgramHosts([root], { projects: PROJECTS, excludeDirs: EXCLUDE_DIRS, exclude })

    expect(new TypeResolver(hosts([])).discover().map((found) => found.name)).toEqual(["Truncate", "Fake"])

    const resolver = new TypeResolver(hosts(["**/spec/**"]))

    expect(resolver.discover().map((found) => found.name)).toEqual(["Truncate"])
    expect(resolver.qualifiers().map((found) => found.name)).toEqual(["If"])
  })

  it("then takes a literal project as a config file or a folder holding one", () => {
    const projectDirs = (projects: string[]): string[] =>
      createNodeTypeProgramHosts([root], { projects }).map((host) => host.projectDir)

    expect(projectDirs(["packages/ui"])).toEqual([path.join(root, "packages", "ui")])
    expect(projectDirs(["apps/web/tsconfig.app.json"])).toEqual([path.join(root, "apps", "web")])
  })

  it("then falls back to the nearest tsconfig above a root no pattern matches in", () => {
    const hosts = createNodeTypeProgramHosts([path.join(root, "packages", "ui", "src")], { projects: PROJECTS })

    expect(hosts.map((host) => host.projectDir)).toEqual([path.join(root, "packages", "ui")])
  })
})

describe("TypeResolver in a monorepo whose root tsconfig spans every package", () => {
  const root = createMonorepo({ extends: "./tsconfig.base.json", include: ["apps/*/src", "packages/*/src"] })
  const hosts = createNodeTypeProgramHosts([root], {
    projects: PROJECTS,
    excludeDirs: EXCLUDE_DIRS,
    exclude: ["**/spec/**"],
  })
  const ui = hosts.findIndex((host) => host.projectDir === path.join(root, "packages", "ui"))
  const reads = jasmine.createSpy("reads")
  const getSourceFile = hosts[ui].host.getSourceFile.bind(hosts[ui].host)

  hosts[ui] = {
    ...hosts[ui],
    host: { ...hosts[ui].host, getSourceFile: (...args) => (reads(), getSourceFile(...args)) },
  }

  const resolver = new TypeResolver(hosts)

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then keeps each package's project but discovers through the root program alone", () => {
    reads.calls.reset()

    expect(hosts.map((host) => path.relative(root, host.projectDir))).toEqual([
      "",
      path.join("apps", "web"),
      path.join("packages", "ui"),
    ])
    expect(resolver.discover().map((found) => found.name)).toEqual(["Truncate"])
    expect(reads).not.toHaveBeenCalled()
  })

  it("then types a package's files under the package's own options", () => {
    const resolved = resolver.resolve([
      { id: "ui", dir: path.join(root, "packages", "ui", "src"), typeText: `import("#ui/props").Props` },
    ])

    expect(resolved.get("ui")?.members.map((member) => member.name)).toEqual(["tone"])
    expect(reads).toHaveBeenCalled()
  })
})
