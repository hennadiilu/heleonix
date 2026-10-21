import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { AnalyzerHost } from "../src/analysis/AnalyzerHost"
import { DEFAULT_TYPESCRIPT_SETTINGS } from "../src/settings/DEFAULT_TYPESCRIPT_SETTINGS"
import { WorkspaceConfigs } from "../src/settings/WorkspaceConfigs"

const BASES = `export abstract class Converter<TValue = unknown, TReturn = unknown, TParams = object> {
  abstract format(value: TValue, params: TParams): Promise<TReturn>
}
export abstract class StyleQualifier<TArgs = object> {
  declare protected readonly args: TArgs
}
`
const converter = (name: string): string => `import { Converter } from "./bases"
export class TruncateConverter extends Converter<string, string, { length: number }> {
  static readonly hxName = "${name}"
  async format(value: string) { return value }
}
`

// `app` links the workspace package `@acme/ui` (whose last build left a meta
// manifest behind) and installs `@acme/store` (whose link resolves into a store).
function createWorkspace(): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-live-types-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  const link = (from: string, to: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, from)), { recursive: true })
    fs.symlinkSync(path.join(root, to), path.join(root, from), "junction")
  }

  write("app/package.json", { name: "app", dependencies: { "@acme/ui": "workspace:*", "@acme/store": "1.0.0" } })
  write("app/tsconfig.json", {
    compilerOptions: { strict: true },
    include: ["src"],
    references: [{ path: "./tools" }],
  })
  write("app/src/bases.ts", BASES)
  write("app/src/TruncateConverter.ts", converter("Truncate"))
  write("app/src/Card.hxs", "color: red;\n")
  write("app/tools/tsconfig.json", { include: ["*.ts"] })
  write("app/tools/build.ts", "export const build = 1\n")

  write("packages/ui/package.json", {
    name: "@acme/ui",
    peerDependencies: { "@heleonix/hx-core": "*" },
    exports: { ".": { hxmeta: "./hx.meta.json" } },
  })
  write("packages/ui/hx.meta.json", {
    schemaVersion: 1,
    package: "@acme/ui",
    converters: [{ name: "Stale", params: [] }],
    themeTokens: { "Ui.gap": "4px" },
  })
  write("packages/ui/tsconfig.json", { compilerOptions: { strict: true }, include: ["src"] })
  write("packages/ui/src/bases.ts", BASES)
  write(
    "packages/ui/src/ToneQualifier.ts",
    `import { StyleQualifier } from "./bases"
     export class ToneQualifier extends StyleQualifier<{ value: string }> {
       static readonly hxName = "Tone"
     }`,
  )

  write("app/node_modules/.pnpm/store/@acme/store/package.json", {
    name: "@acme/store",
    exports: { ".": { hxmeta: "./hx.meta.json" } },
  })
  write("app/node_modules/.pnpm/store/@acme/store/hx.meta.json", {
    schemaVersion: 1,
    package: "@acme/store",
    converters: [{ name: "Installed", params: [] }],
  })

  link("app/node_modules/@acme/ui", "packages/ui")
  link("app/node_modules/@acme/store", "app/node_modules/.pnpm/store/@acme/store")

  return root
}

function seeded(root: string, linkedPackages: boolean): AnalyzerHost {
  const host = new AnalyzerHost(
    new WorkspaceConfigs({ severity: {}, typescript: { ...DEFAULT_TYPESCRIPT_SETTINGS, linkedPackages } }),
  )

  host.seed([path.join(root, "app")], new Set(["node_modules"]))

  return host
}

function appFile(root: string): string {
  return path.join(root, "app", "src", "Card.hxs")
}

describe("AnalyzerHost over linked workspace packages", () => {
  const root = createWorkspace()

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reads a linked package's classes from its TypeScript sources", async () => {
    const snapshot = await seeded(root, true).snapshot(appFile(root))

    expect(snapshot.qualifiers.map((qualifier) => qualifier.name)).toContain("Tone")
    expect(snapshot.converters.map((found) => found.name)).toContain("Truncate")
  })

  it("then drops the class contracts a linked package's meta carries, keeping the rest and installed packages'", async () => {
    const snapshot = await seeded(root, true).snapshot(appFile(root))

    expect(snapshot.converters.map((found) => found.name).sort()).toEqual(["Installed", "Truncate"])
    expect(snapshot.themeTokens.get("Ui.gap")).toBe("4px")
  })

  it("then reads no linked package unless asked, keeping its meta whole", async () => {
    const snapshot = await seeded(root, false).snapshot(appFile(root))

    expect(snapshot.qualifiers.map((qualifier) => qualifier.name)).not.toContain("Tone")
    expect(snapshot.converters.map((found) => found.name)).toEqual(["Installed", "Stale", "Truncate"])
  })

  it("then watches each workspace folder and linked package once", () => {
    expect(seeded(root, true).typeProjectDirs()).toEqual([path.join(root, "app"), path.join(root, "packages", "ui")])
  })
})

describe("AnalyzerHost after a TypeScript source changes", () => {
  const root = createWorkspace()
  const converterPath = path.join(root, "app", "src", "TruncateConverter.ts")

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then re-reads it once told the types changed", async () => {
    const host = seeded(root, true)
    const later = new Date(Date.now() + 5000)

    await host.snapshot(appFile(root))
    fs.writeFileSync(converterPath, converter("Shorten"))
    fs.utimesSync(converterPath, later, later)

    expect((await host.snapshot(appFile(root))).converters.map((found) => found.name)).toContain("Truncate")

    host.typesChanged()
    expect((await host.snapshot(appFile(root))).converters.map((found) => found.name)).toEqual(["Installed", "Shorten"])
  })
})

// `web` depends on the library `@acme/ui` and on `@acme/util`, which does not
// depend on the runtime; `admin` on nothing. The library's config also takes
// in its tests.
describe("AnalyzerHost in a monorepo opened at its root, with the default settings", () => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-monorepo-host-")))
  const webFile = path.join(root, "apps", "web", "src", "Card.hxs")
  const uiFile = path.join(root, "packages", "ui", "src", "Badge.hxs")
  const adminFile = path.join(root, "apps", "admin", "src", "Panel.hxs")
  let host: AnalyzerHost

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  beforeAll(() => {
    write("package.json", { name: "mono", private: true })
    write("apps/web/package.json", {
      name: "web",
      dependencies: { "@acme/ui": "workspace:*", "@acme/util": "workspace:*" },
    })
    write("apps/web/tsconfig.json", { files: [], references: [{ path: "./tsconfig.app.json" }] })
    write("apps/web/tsconfig.app.json", { compilerOptions: { strict: true }, include: ["src"] })
    write("apps/web/src/bases.ts", BASES)
    write("apps/web/src/TruncateConverter.ts", converter("Truncate"))
    write("apps/web/src/Card.hxs", "color: red;\n")
    write("apps/web/src/Brand.hxt", "Brand { accent: red; }")
    write("apps/admin/package.json", { name: "admin" })
    write("apps/admin/src/Panel.hxs", "color: red;\n")
    write("packages/ui/package.json", { name: "@acme/ui", peerDependencies: { "@heleonix/hx-core": "*" } })
    write("packages/ui/tsconfig.json", { compilerOptions: { strict: true }, include: ["src", "spec"] })
    write("packages/ui/src/bases.ts", BASES)
    write(
      "packages/ui/src/ToneQualifier.ts",
      `import { StyleQualifier } from "./bases"
       export class ToneQualifier extends StyleQualifier<{ value: string }> {
         static readonly hxName = "Tone"
       }`,
    )
    write("packages/ui/src/Badge.hxs", "color: red;\n")
    write("packages/ui/spec/FakeConverter.ts", converter("Fake").replace("./bases", "../src/bases"))
    write("packages/util/package.json", { name: "@acme/util" })
    write("packages/util/tsconfig.json", { compilerOptions: { strict: true }, include: ["src"] })
    write("packages/util/src/bases.ts", BASES)
    write("packages/util/src/HelperConverter.ts", converter("Helper"))

    host = new AnalyzerHost()
    host.seed([root], new Set(["node_modules", "dist", "temp", "out"]))
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then gives a package its own classes and its dependencies', never test fixtures", async () => {
    const web = await host.snapshot(webFile)

    expect(web.converters.map((found) => found.name)).toEqual(["Truncate"])
    expect(web.qualifiers.map((qualifier) => qualifier.name)).toEqual(["Tone"])
  })

  it("then reads no class from a dependency that cannot declare one, though the package itself can", async () => {
    expect((await host.snapshot(webFile)).converters.map((found) => found.name)).not.toContain("Helper")
    expect(
      (await host.snapshot(path.join(root, "packages", "util", "src", "Any.hxs"))).converters.map(
        (found) => found.name,
      ),
    ).toEqual(["Helper"])
  })

  it("then keeps a library from seeing what its dependents declare", async () => {
    const ui = await host.snapshot(uiFile)

    expect(ui.converters).toEqual([])
    expect(ui.qualifiers.map((qualifier) => qualifier.name)).toEqual(["Tone"])
    expect(ui.themeTokens.has("Brand.accent")).toBeFalse()
    expect((await host.snapshot(webFile)).themeTokens.get("Brand.accent")).toBe("red")
    expect((await host.snapshot(adminFile)).qualifiers).toEqual([])
  })

  it("then watches the workspace folder for new projects", () => {
    expect(host.typeProjectDirs()).toEqual([root])
  })
})
