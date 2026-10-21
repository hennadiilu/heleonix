import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { HX_CONFIG_FILE, isIncludedSource, loadHxConfig } from "@heleonix/hx-plugin-core"

describe("loadHxConfig", () => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-config-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  beforeAll(() => {
    write(
      HX_CONFIG_FILE,
      `{
        // Shared policy for every package.
        "dimensions": "./hx.dimensions.json",
        "typescript": { "exclude": ["**/spec/**"], "linkedPackages": true },
        "diagnostics": { "severity": { "HX_ANALYZER_0002": "warning", "HX_ANALYZER_0004": "off" } },
      }`,
    )
    write("hx.dimensions.json", [{ name: "culture", values: ["en-US", "uk-UA"] }])
    write(`apps/web/${HX_CONFIG_FILE}`, {
      extends: "../../hx.config.json",
      include: ["src"],
      exclude: ["fixtures", "./src/legacy"],
      diagnostics: { severity: { HX_ANALYZER_0004: "error" }, failOnWarnings: true },
    })
    write("node_modules/@acme/config/hx.config.json", { diagnostics: { severity: { HX_ANALYZER_0009: "hint" } } })
    write("node_modules/@acme/config/package.json", { name: "@acme/config" })
    write(`apps/admin/${HX_CONFIG_FILE}`, { extends: "@acme/config/hx.config.json", include: ["lib"] })
    write(`loops/a/${HX_CONFIG_FILE}`, { extends: "../b" })
    write(`loops/b/${HX_CONFIG_FILE}`, { extends: "../a/hx.config.json" })
    write(`broken/${HX_CONFIG_FILE}`, { diagnostics: { severity: { HX_ANALYZER_0001: "warn" } } })
    fs.mkdirSync(path.join(root, "apps", "web", "src", "deep"), { recursive: true })
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reads the nearest configuration above a directory, merged over the one it extends", () => {
    const { config, files, missing } = loadHxConfig(path.join(root, "apps", "web", "src", "deep"))

    expect(config?.file).toBe(path.join(root, "apps", "web", HX_CONFIG_FILE))
    expect(config?.diagnostics).toEqual({
      severity: { HX_ANALYZER_0002: "warning", HX_ANALYZER_0004: "error" },
      failOnWarnings: true,
    })
    expect(config?.typescript?.linkedPackages).toBeTrue()
    expect(files).toEqual([
      path.join(root, "apps", "web", HX_CONFIG_FILE),
      path.join(root, HX_CONFIG_FILE),
      path.join(root, "hx.dimensions.json"),
    ])
    expect(missing).toEqual([
      path.join(root, "apps", "web", "src", "deep", HX_CONFIG_FILE),
      path.join(root, "apps", "web", "src", HX_CONFIG_FILE),
    ])
  })

  it("then resolves paths against the file declaring them, keeping folder names as names", () => {
    const { config } = loadHxConfig(path.join(root, "apps", "web"))

    expect(config?.include).toEqual([path.join(root, "apps", "web", "src")])
    expect(config?.exclude).toEqual(["fixtures", path.join(root, "apps", "web", "src", "legacy")])
    expect(config?.typescript?.exclude).toEqual({ base: root, patterns: ["**/spec/**"] })
    expect(config?.dimensions).toEqual([{ name: "culture", values: ["en-US", "uk-UA"] }])
  })

  it("then extends a configuration an installed package ships", () => {
    const { config } = loadHxConfig(path.join(root, "apps", "admin"))

    expect(config?.diagnostics?.severity).toEqual({ HX_ANALYZER_0009: "hint" })
    expect(config?.include).toEqual([path.join(root, "apps", "admin", "lib")])
  })

  it("then finds none above a directory no configuration governs, listing every place it looked", () => {
    const top = path.parse(root).root
    const result = loadHxConfig(top)

    expect(result.config).toBeUndefined()
    expect(result.missing).toEqual([path.join(top, HX_CONFIG_FILE)])
  })

  it("then reports a configuration extending itself, naming the cycle", () => {
    const { config, error } = loadHxConfig(path.join(root, "loops", "a"))

    expect(config).toBeUndefined()
    expect(error?.code).toBe("HX_PLUGIN_0601")
    expect(error?.message.split(" -> ").map((file) => path.basename(path.dirname(file)))).toEqual(["a", "b", "a"])
  })

  it("then reports the file at fault, and where in it when known", () => {
    const level = loadHxConfig(path.join(root, "broken"))

    expect(level.error).toEqual(
      jasmine.objectContaining({ file: path.join(root, "broken", HX_CONFIG_FILE), code: "HX_PLUGIN_0600" }),
    )
    expect(level.error?.message).toMatch(/warn/)

    write(`syntax/${HX_CONFIG_FILE}`, `{ "include": ["src"] "exclude": [] }`)

    const syntax = loadHxConfig(path.join(root, "syntax"))

    expect(syntax.files).toEqual([path.join(root, "syntax", HX_CONFIG_FILE)])
    expect(syntax.error?.offset).toBeGreaterThan(0)
  })

  it("then reads through the host it is given - an editor's unsaved documents, say", () => {
    const unsaved = path.join(root, "apps", "web", HX_CONFIG_FILE)
    const host = {
      readFile: (file: string) =>
        file === unsaved ? `{ "include": ["lib"] }` : fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined,
      resolvePackage: () => undefined,
    }

    expect(loadHxConfig(path.join(root, "apps", "web"), host).config?.include).toEqual([
      path.join(root, "apps", "web", "lib"),
    ])
  })
})

describe("isIncludedSource", () => {
  const base = path.resolve("/repo/apps/web")
  const include = [path.join(base, "src")]

  it("then takes files below an include directory, outside dot-folders and excluded folders", () => {
    expect(isIncludedSource(path.join(base, "src", "Card.hxs"), include, [])).toBeTrue()
    expect(isIncludedSource(path.join(base, "tests", "Card.hxs"), include, [])).toBeFalse()
    expect(isIncludedSource(path.join(base, "src", ".cache", "Card.hxs"), include, [])).toBeFalse()
    expect(isIncludedSource(path.join(base, "src", "a", "fixtures", "Card.hxs"), include, ["fixtures"])).toBeFalse()
  })

  it("then skips everything under an excluded path", () => {
    const exclude = [path.join(base, "src", "legacy")]

    expect(isIncludedSource(path.join(base, "src", "legacy", "old", "Card.hxs"), include, exclude)).toBeFalse()
    expect(isIncludedSource(path.join(base, "src", "legacyish", "Card.hxs"), include, exclude)).toBeTrue()
  })
})
