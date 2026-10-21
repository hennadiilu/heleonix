import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  PackageMetaBuilder,
  PackageValidation,
  buildLevelOf,
  configReportOf,
  isSkipped,
  packageTypeHosts,
  parseAssetFileName,
  resolveBuildSettings,
  type IAssetFile,
} from "@heleonix/hx-plugin-core"

const BASES = `export abstract class Converter<TValue = unknown, TReturn = unknown, TParams = object> {
  abstract format(value: TValue, params: TParams): Promise<TReturn>
}
`

function createPackage(): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-build-core-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  write("package.json", { name: "@acme/web", version: "2.1.0" })
  write("tsconfig.json", { compilerOptions: { strict: true }, include: ["src", "spec"] })
  write("hx.config.json", {
    include: ["src"],
    exclude: ["fixtures"],
    dimensions: [{ name: "culture", values: ["en-US"] }],
    typescript: { exclude: ["**/spec/**"] },
    diagnostics: { severity: { HX_ANALYZER_0002: "warning" } },
  })
  write("src/bases.ts", BASES)
  write(
    "src/TruncateConverter.ts",
    `import { Converter } from "./bases"
     export class TruncateConverter extends Converter<string, string, { length: number }> {
       static readonly hxName = "Truncate"
       async format(value: string) { return value }
     }`,
  )
  write(
    "spec/FakeConverter.ts",
    `import { Converter } from "../src/bases"
     export class FakeConverter extends Converter<string, string> {
       static readonly hxName = "Fake"
       async format(value: string) { return value }
     }`,
  )
  write("src/Labels.hxd", `{ "title": "Title" }`)
  write("src/Labels.en-US.hxd", `{ "title": "Title (US)" }`)
  write(
    "src/Badge.hxm",
    `---\nprops: { tone: 'calm' | 'loud' }\n---\n<Component><Label name="label" />{@Labels.missing}</Component>`,
  )
  write("src/Label.hxm", "<Component><Content /></Component>")
  write("src/Theme.hxt", "Palette { accent: red; }")
  write("src/fixtures/Fake.hxd", `{ "fake": "Fake" }`)

  return root
}

function sourcesOf(root: string, settings: ReturnType<typeof resolveBuildSettings>): IAssetFile[] {
  const sources: IAssetFile[] = []

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!settings.exclude.includes(entry.name)) {
          walk(full)
        }
      } else if (/\.hx[mdct]$|\.hxs$/.test(entry.name)) {
        const asset = parseAssetFileName(full, settings.dimensions)

        if (!isSkipped(asset)) {
          sources.push({ absPath: full, ...asset })
        }
      }
    }
  }

  settings.include.forEach(walk)

  return sources
}

describe("resolveBuildSettings", () => {
  const root = createPackage()

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then takes what the plugin's options leave out from the package's configuration", () => {
    const settings = resolveBuildSettings(root)

    expect(settings.include).toEqual([path.join(root, "src")])
    expect(settings.exclude).toEqual(["fixtures"])
    expect(settings.dimensions).toEqual([{ name: "culture", values: ["en-US"] }])
    expect(settings.severity).toEqual({ HX_ANALYZER_0002: "warning" })
    expect(settings.failOnWarnings).toBeFalse()
    expect(settings.typescriptExclude).toEqual({ base: root, patterns: ["**/spec/**"] })
    expect(settings.lookup.files).toContain(path.join(root, "hx.config.json"))
  })

  it("then lets the plugin's options win, resolved against the build's context", () => {
    const settings = resolveBuildSettings(root, {
      include: "./lib",
      exclude: ["./src/old", "tmp"],
      dimensions: [{ name: "brand", values: ["acme"] }],
      failOnWarnings: true,
    })

    expect(settings.include).toEqual([path.join(root, "lib")])
    expect(settings.exclude).toEqual([path.join(root, "src", "old"), "tmp"])
    expect(settings.dimensions).toEqual([{ name: "brand", values: ["acme"] }])
    expect(settings.failOnWarnings).toBeTrue()
  })

  it("then falls back to every source under the context when no configuration governs it", () => {
    const top = path.parse(root).root
    const settings = resolveBuildSettings(top)

    expect(settings.include).toEqual([top])
    expect(settings.exclude).toEqual(["node_modules"])
  })
})

describe("buildLevelOf", () => {
  const settings = {
    severity: { A: "warning", B: "information", C: "off", D: "error" } as const,
    failOnWarnings: false,
  }

  it("then reports a diagnostic at its configured level, else its own", () => {
    expect(["A", "B", "C", "D", "E"].map((code) => buildLevelOf(code, "error", settings))).toEqual([
      "warning",
      undefined,
      undefined,
      "error",
      "error",
    ])
  })

  it("then fails on warnings when asked", () => {
    expect(buildLevelOf("A", "error", { ...settings, failOnWarnings: true })).toBe("error")
  })
})

describe("configReportOf", () => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-config-report-")))

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reports a broken configuration as a build error at the line and column at fault", () => {
    fs.writeFileSync(path.join(root, "hx.config.json"), `{\n  "include": ["src"]\n  "exclude": []\n}`)

    const report = configReportOf(resolveBuildSettings(root).lookup)

    expect(report?.level).toBe("error")
    expect(report?.text).toMatch(/^HX_PLUGIN_0600: /)
    expect(report?.text).toContain(`${path.join(root, "hx.config.json")}:3:`)
  })
})

describe("PackageValidation", () => {
  const root = createPackage()

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reports findings at their configured build levels", async () => {
    const settings = resolveBuildSettings(root)
    const validation = new PackageValidation(packageTypeHosts(root, settings), [], settings)
    const reports = await validation.reports(sourcesOf(root, settings))

    expect(reports.map((report) => [report.level, report.code])).toEqual([["warning", "HX_ANALYZER_0002"]])
    expect(reports[0].text).toContain(`${path.join(root, "src", "Badge.hxm")}:`)
  })

  it("then forgets a source once it is gone", async () => {
    const settings = resolveBuildSettings(root)
    const validation = new PackageValidation([], [], { ...settings, failOnWarnings: true })
    const sources = sourcesOf(root, settings)

    expect((await validation.reports(sources)).map((report) => report.level)).toEqual(["error"])
    expect(await validation.reports(sources.filter((asset) => asset.name !== "Badge"))).toEqual([])
  })
})

describe("PackageMetaBuilder", () => {
  const root = createPackage()

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then describes the package's sources and its own classes, leaving out excluded ones", async () => {
    const settings = resolveBuildSettings(root)
    const builder = new PackageMetaBuilder(root, packageTypeHosts(root, settings))
    const { meta, failures } = await builder.build(sourcesOf(root, settings))

    expect(failures).toEqual([])
    expect(meta.package).toBe("@acme/web")
    expect(meta.version).toBe("2.1.0")
    expect(meta.converters?.map((entry) => entry.name)).toEqual(["Truncate"])
    expect(meta.themeTokens).toEqual({ "Palette.accent": "red" })

    const badge = meta.components?.find((entry) => entry.name === "Badge")

    expect(badge?.props?.map((member) => [member.name, member.enumValues])).toEqual([["tone", ["calm", "loud"]]])
    expect(badge?.controls).toContain("label")
  })
})
