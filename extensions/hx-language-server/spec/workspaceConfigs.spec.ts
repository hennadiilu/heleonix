import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { AnalyzerHost } from "../src/analysis/AnalyzerHost"
import { DefinitionRegistry } from "../src/sources/DefinitionRegistry"
import { WorkspaceDefinitionSource } from "../src/sources/WorkspaceDefinitionSource"
import { WorkspaceConfigs } from "../src/settings/WorkspaceConfigs"
import { DEFAULT_TYPESCRIPT_SETTINGS } from "../src/settings/DEFAULT_TYPESCRIPT_SETTINGS"

// The root configuration sets shared levels; `web` compiles `src` (without its
// fixtures) under a culture dimension; `loose` has no configuration of its own
// but sits under the root's; `broken` cannot be read.
function createWorkspace(): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-workspace-configs-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  write("hx.config.json", {
    diagnostics: { severity: { HX_ANALYZER_0002: "warning", HX_LANGUAGE_SERVER_0001: "off" } },
    typescript: { exclude: ["**/stories/**"] },
  })
  write("web/hx.config.json", {
    extends: "../hx.config.json",
    include: ["src"],
    exclude: ["fixtures"],
    dimensions: [{ name: "culture", values: ["en-US", "uk-UA"] }],
    diagnostics: { severity: { HX_ANALYZER_0003: "off" } },
  })
  write("web/src/Labels.hxd", `{ "title": "Title" }`)
  write("web/src/Labels.uk-UA.hxd", `{ "title": "Назва" }`)
  write("web/src/Labels.de-DE.hxd", `{ "title": "Titel" }`)
  write("web/src/fixtures/Fake.hxd", `{ "fake": "Fake" }`)
  write("web/stories/Story.hxd", `{ "story": "Story" }`)
  write(
    "web/src/Page.hxm",
    `<Component><span>{@Labels.title}</span><span>{@Labels.missing}</span><span>{#Layout.nope}</span></Component>`,
  )
  write("broken/hx.config.json", `{ "include": "src" }`)

  return root
}

describe("WorkspaceConfigs", () => {
  const root = createWorkspace()
  const configs = new WorkspaceConfigs({
    severity: { HX_ANALYZER_0002: "error", HX_ANALYZER_0009: "hint" },
    typescript: DEFAULT_TYPESCRIPT_SETTINGS,
  })
  const web = (file: string): string => path.join(root, "web", file)

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then compiles what the build compiles: included sources within the configured dimensions", () => {
    expect(configs.compiles(web("src/Labels.hxd"))).toBeTrue()
    expect(configs.compiles(web("src/Labels.uk-UA.hxd"))).toBeTrue()
    expect(configs.compiles(web("src/Labels.de-DE.hxd"))).toBeFalse()
    expect(configs.compiles(web("src/fixtures/Fake.hxd"))).toBeFalse()
    expect(configs.compiles(web("stories/Story.hxd"))).toBeFalse()
    expect(configs.compiles(path.join(root, "loose", "Notes.hxd"))).toBeTrue()
  })

  it("then names a file and its dimension as the build does", () => {
    expect(configs.assetOf(web("src/Labels.uk-UA.hxd"))).toEqual({ name: "Labels", dimension: { culture: "uk-UA" } })
  })

  it("then levels a diagnostic by its configuration, else the editor setting, else its own", () => {
    expect(configs.levelOf("HX_ANALYZER_0003", "error", web("src/Page.hxm"))).toBe("off")
    expect(configs.levelOf("HX_ANALYZER_0002", "error", web("src/Page.hxm"))).toBe("warning")
    expect(configs.levelOf("HX_ANALYZER_0009", "error", web("src/Page.hxm"))).toBe("hint")
    expect(configs.levelOf("HX_ANALYZER_0001", "error", web("src/Page.hxm"))).toBe("error")
  })

  it("then takes TypeScript settings from a folder's configuration, else from the editor", () => {
    expect(configs.typescriptOf(path.join(root, "web")).exclude).toEqual({ base: root, patterns: ["**/stories/**"] })
    expect(configs.typescriptOf(path.join(root, "web")).projects).toEqual({
      base: path.join(root, "web"),
      patterns: DEFAULT_TYPESCRIPT_SETTINGS.projects,
    })
  })

  it("then reports a broken configuration on its file and reads its folder as unconfigured", () => {
    expect(configs.compiles(path.join(root, "broken", "src", "A.hxd"))).toBeTrue()
    expect(configs.errors()).toEqual([
      jasmine.objectContaining({ file: path.join(root, "broken", "hx.config.json"), code: "HX_PLUGIN_0600" }),
    ])
  })

  it("then lists what to watch: every file read, and every place a configuration may appear", () => {
    configs.compiles(web("src/Labels.hxd"))

    const { files, missing } = configs.inputs()

    expect(files).toEqual(
      jasmine.arrayContaining([path.join(root, "web", "hx.config.json"), path.join(root, "hx.config.json")]),
    )
    expect(missing).toContain(path.join(root, "web", "src", "hx.config.json"))
    expect(configs.isInput(path.join(root, "web", "src", "hx.config.json"))).toBeTrue()
    expect(configs.isInput(web("src/Labels.hxd"))).toBeFalse()
  })

  it("then reads through its host - an editor's unsaved documents", () => {
    const unsaved = path.join(root, "web", "hx.config.json")
    const live = new WorkspaceConfigs(undefined, {
      readFile: (file) =>
        file === unsaved
          ? JSON.stringify({ include: ["stories"] })
          : fs.existsSync(file) && fs.statSync(file).isFile()
            ? fs.readFileSync(file, "utf8")
            : undefined,
      resolvePackage: () => undefined,
    })

    expect(live.compiles(web("stories/Story.hxd"))).toBeTrue()
    expect(live.compiles(web("src/Labels.hxd"))).toBeFalse()
  })
})

describe("the language server reading hx.config.json", () => {
  const root = createWorkspace()
  const pagePath = path.join(root, "web", "src", "Page.hxm")

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reports analyzer findings at the configured levels, silencing those turned off", async () => {
    const host = new AnalyzerHost(new WorkspaceConfigs())

    host.addMeta({ schemaVersion: 1, components: [{ name: "span", dimension: {}, open: true }] })
    host.seed([root], new Set(["node_modules"]))

    const source = fs.readFileSync(pagePath, "utf8")
    const document = TextDocument.create(pathToFileURL(pagePath).href, "hxm", 1, source)
    const found = (await host.diagnosticsFor(pagePath, document)).map((d) => [d.code, d.severity])

    expect(found).toEqual([["HX_ANALYZER_0002", DiagnosticSeverity.Warning]])
  })

  it("then indexes only the sources the build compiles", async () => {
    const configs = new WorkspaceConfigs()
    const registry = new DefinitionRegistry()

    registry.register(
      new WorkspaceDefinitionSource([root], new Set(["node_modules"]), (file) => configs.compiles(file)),
    )
    await registry.rebuild()

    expect(registry.getIndex().names("dictionary")).toEqual(["Labels"])
  })
})
