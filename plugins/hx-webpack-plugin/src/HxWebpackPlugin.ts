import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import VirtualModulesPlugin from "webpack-virtual-modules"
import type { Compiler, WebpackError } from "webpack"
import type {
  IComponentDefinition,
  IComponentHeader,
  IComponentMetaEntry,
  IDimensionDefinition,
  IDocsEntry,
  IQualifierDefinition,
  IRegistryMetaEntry,
  IThemeDefinition,
} from "@heleonix/hx-language"
import {
  EXT_KIND,
  EXT_TEMPLATE,
  EXT_THEME,
  KINDS,
  collectControlNames,
  flattenThemeTokens,
  type Kind,
} from "@heleonix/hx-language"
import {
  scan,
  parseAssetFileName,
  compileAsset,
  compileAssetDocs,
  compileAssetHeader,
  buildMeta,
  loadDependencyMetas,
  generateDefinitionSource,
  generateDefinitionSourceDeclaration,
  generateDefinitionDeclarations,
  isSkipped,
  DEFINITION_SOURCE_BASE_CLASS,
  type IAssetFile,
} from "@heleonix/hx-plugin-core"
import { Analyzer, createNodeTypeProgramHost, TypeResolver } from "@heleonix/hx-analyzer"
import type { ITypeProgramHost } from "@heleonix/hx-analyzer"
import { IHxDefinitionSourceOptions } from "./IHxDefinitionSourceOptions"
import { IHxWebpackPluginOptions } from "./IHxWebpackPluginOptions"
import { IHxEmitDefinitionSourcesOptions } from "./IHxEmitDefinitionSourcesOptions"
import { HeleonixWebpackPluginError } from "./errors/HeleonixWebpackPluginError"
import { Errors } from "./errors/Errors"

const PLUGIN_NAME = "HxWebpackPlugin"

const HERE = fileURLToPath(import.meta.url)
const LOADER_PATH = path.join(path.dirname(HERE), `hxWebpackLoader${path.extname(HERE)}`)

// Guards against the same compiler being configured twice (double `apply`), which
// would otherwise duplicate the module rule and resolve aliases.
const appliedCompilers = new WeakSet<Compiler>()

const DEFAULT_DEFINITION_SOURCES: Readonly<Record<Kind, Required<IHxDefinitionSourceOptions>>> = {
  component: { className: "CompiledComponentDefinitionSource", moduleName: "hx-compiled-components" },
  dictionary: { className: "CompiledDictionaryDefinitionSource", moduleName: "hx-compiled-dictionaries" },
  config: { className: "CompiledConfigDefinitionSource", moduleName: "hx-compiled-configs" },
  style: { className: "CompiledStyleDefinitionSource", moduleName: "hx-compiled-styles" },
  theme: { className: "CompiledThemeDefinitionSource", moduleName: "hx-compiled-themes" },
}

export class HxWebpackPlugin {
  private readonly dimensions: readonly IDimensionDefinition[]
  private readonly include: string[]
  private readonly exclude: string[]
  private readonly kinds: readonly Kind[]
  private readonly sources: Record<Kind, Required<IHxDefinitionSourceOptions>>
  private readonly declarationFile?: string
  private readonly loading: "eager" | "lazy"
  private readonly chunkName?: (file: IAssetFile) => string | undefined
  private readonly emitJson?: boolean | ((file: IAssetFile) => string)
  private readonly emitMeta?: boolean | string
  private readonly validate?: { failOnWarnings?: boolean }
  private readonly emitDefinitionSources?: IHxEmitDefinitionSourcesOptions
  private readonly explicitClassNames: Partial<Record<Kind, string>>

  public constructor(options: IHxWebpackPluginOptions = {}) {
    this.dimensions = options.dimensions ?? []
    this.include = toArray(options.include ?? ["."])
    this.exclude = toArray(options.exclude ?? ["node_modules"])
    this.kinds = options.kinds ?? KINDS
    this.declarationFile = options.declarationFile
    this.loading = options.loading ?? "eager"
    this.chunkName = options.chunkName
    this.emitJson = options.emitJson
    this.emitMeta = options.emitMeta
    this.validate = options.validate === true ? {} : options.validate || undefined
    this.emitDefinitionSources =
      options.emitDefinitionSources === true ? {} : options.emitDefinitionSources || undefined
    this.explicitClassNames = {}
    this.sources = {} as Record<Kind, Required<IHxDefinitionSourceOptions>>

    for (const kind of this.kinds) {
      this.sources[kind] = { ...DEFAULT_DEFINITION_SOURCES[kind], ...options.sources?.[kind] }

      const explicit = options.sources?.[kind]?.className

      if (explicit) {
        this.explicitClassNames[kind] = explicit
      }
    }
  }

  public apply(compiler: Compiler): void {
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME)

    if (appliedCompilers.has(compiler)) {
      logger.warn(`${PLUGIN_NAME} is applied more than once for the same compiler; ignoring the extra registration.`)
      return
    }
    appliedCompilers.add(compiler)

    const context = compiler.context
    const includeDirs = this.include.map((dir) => path.resolve(context, dir))
    const selectedKinds = new Set(this.kinds)
    const exts = new Set(Object.keys(EXT_KIND).filter((ext) => selectedKinds.has(EXT_KIND[ext])))

    // Emit the declaration file typing the generated modules. It depends only on the
    // configuration, so writing it once here keeps it in sync; `writeIfChanged` avoids
    // touching it when unchanged so it never retriggers the watcher.
    if (this.declarationFile) {
      writeIfChanged(
        path.resolve(context, this.declarationFile),
        generateDefinitionDeclarations(this.kinds, this.sources),
      )
    }

    // Resolve excludes once - same interpretation `scan` uses - so the watch-rebuild
    // candidate check stays consistent with the initial full scan.
    const excludeNames = new Set<string>()
    const excludePaths = new Set<string>()
    for (const item of this.exclude) {
      if (path.isAbsolute(item) || item.includes("/") || item.includes("\\")) {
        excludePaths.add(path.resolve(context, item))
      } else {
        excludeNames.add(item)
      }
    }

    const isCandidate = (file: string): boolean => {
      if (!exts.has(path.extname(file))) {
        return false
      }

      if (!includeDirs.some((dir) => file === dir || file.startsWith(dir + path.sep))) {
        return false
      }

      for (const segment of path.dirname(file).split(/[\\/]/)) {
        if (excludeNames.has(segment)) {
          return false
        }
      }

      for (const excluded of excludePaths) {
        if (file === excluded || file.startsWith(excluded + path.sep)) {
          return false
        }
      }

      return true
    }

    // 1. Register the loader for the selected Heleonix source extensions. `enforce: "pre"`
    //    keeps it ahead of any user loaders that might also match these extensions.
    const test = new RegExp(`\\.(${[...exts].map((ext) => ext.slice(1)).join("|")})$`)
    compiler.options.module.rules.push({
      test,
      enforce: "pre",
      use: [{ loader: LOADER_PATH, options: { dimensions: this.dimensions } }],
    })

    // 2. Wire virtual modules + a resolve alias per generated source.
    const virtual = new VirtualModulesPlugin()
    virtual.apply(compiler)

    // Synthetic in-memory ids for the generated aggregator modules. They never touch
    // disk; the path only namespaces them under the project to avoid collisions.
    const virtualRoot = path.resolve(context, "node_modules/.cache/hx-plugin")
    const virtualPaths = {} as Record<Kind, string>

    compiler.options.resolve.alias = compiler.options.resolve.alias || {}
    const alias = compiler.options.resolve.alias as Record<string, string>

    for (const kind of this.kinds) {
      const { className, moduleName } = this.sources[kind]
      virtualPaths[kind] = path.join(virtualRoot, `${className}.js`)
      // `$` => exact match, so the bare specifier resolves to the virtual module.
      alias[`${moduleName}$`] = virtualPaths[kind]
    }

    // 3. Maintain the set of source files across (re)builds so most rebuilds avoid a
    //    full filesystem walk and only the affected kinds are regenerated.
    const assets = new Map<string, { kind: Kind; asset: IAssetFile }>()
    let firstRun = true

    const indexAsset = (file: string): Kind | null => {
      const result = parseAssetFileName(file, this.dimensions)

      if (isSkipped(result)) {
        logger.debug(`Skipping '${file}': value '${result.unmatchedSegment}' is outside the configured dimensions.`)
        return null
      }

      const kind = EXT_KIND[result.ext]
      assets.set(file, { kind, asset: { absPath: file, ...result } })
      return kind
    }

    const regenerate = (): void => {
      const changedKinds = new Set<Kind>()

      if (firstRun) {
        firstRun = false
        assets.clear()

        let skipped = 0
        for (const file of scan(includeDirs, exts, this.exclude, context)) {
          if (indexAsset(file) === null) {
            skipped++
          }
        }

        if (skipped > 0) {
          logger.info(`Skipped ${skipped} source(s) outside the configured dimensions.`)
        }

        // Emit every selected kind once so its alias resolves even with zero sources.
        for (const kind of this.kinds) {
          changedKinds.add(kind)
        }
      } else {
        // Watch rebuild: react only to added/removed sources. Pure content edits keep
        // the aggregator unchanged (the loader recompiles the file on its own).
        for (const file of compiler.removedFiles ?? []) {
          const entry = assets.get(file)
          if (entry) {
            assets.delete(file)
            changedKinds.add(entry.kind)
          }
        }

        for (const file of compiler.modifiedFiles ?? []) {
          if (assets.has(file) || !isCandidate(file)) {
            continue
          }

          const kind = indexAsset(file)
          if (kind !== null) {
            changedKinds.add(kind)
          }
        }
      }

      if (changedKinds.size === 0) {
        return
      }

      const byKind = {} as Record<Kind, IAssetFile[]>
      for (const kind of changedKinds) {
        byKind[kind] = []
      }
      for (const { kind, asset } of assets.values()) {
        byKind[kind]?.push(asset)
      }

      for (const kind of changedKinds) {
        const content = generateDefinitionSource(kind, this.sources[kind].className, byKind[kind], {
          loading: this.loading,
          chunkName: this.chunkName,
        })
        virtual.writeModule(virtualPaths[kind], content)
      }
    }

    compiler.hooks.beforeCompile.tap(PLUGIN_NAME, regenerate)

    // 4. Watch the scanned directories so adding/removing a source re-triggers a build.
    compiler.hooks.afterCompile.tap(PLUGIN_NAME, (compilation) => {
      for (const dir of includeDirs) {
        compilation.contextDependencies.add(dir)
      }
    })

    // 5. Library-mode emission: standalone `.json` per compiled source (plus `.docs.json`
    //    sidecars / a docs bundle), plus plain (unbundled) definition-source modules
    //    importing the definitions by relative path. Emission is driven by the scanned
    //    asset set, not the module graph, so sources are emitted whether or not anything
    //    imports them.
    const ds = this.emitDefinitionSources
    const metaFile = this.emitMeta === true ? "hx.meta.json" : this.emitMeta || undefined

    if (!this.emitJson && !ds && !metaFile && !this.validate) {
      return
    }

    // The TypeScript program host (project `tsconfig` + `.ts` files) backs both
    // prop/type validation and converter/action class discovery for the meta
    // manifest, so it is built once and shared.
    const typeHost = this.validate || metaFile ? createNodeTypeProgramHost(context) : undefined

    // One analyzer per compiler: it persists across watch rebuilds, and
    // `analyzerSetFile` feeds it only files whose content actually changed, so
    // rebuild validation recompiles just the edited sources.
    const analyzer = this.validate ? new Analyzer() : undefined

    if (analyzer) {
      if (typeHost) {
        analyzer.setTypeProgramHost(typeHost)
      }

      for (const meta of loadDependencyMetas(context)) {
        analyzer.addMeta(meta)
      }
    }
    const analyzedMtimes = new Map<string, number>()
    const analyzedPaths = new Set<string>()

    const analyzerSetFile = (absPath: string, ext: string, name: string, dimension: IAssetFile["dimension"]): void => {
      if (!analyzer) {
        return
      }

      analyzedPaths.add(absPath)

      const mtimeMs = fs.statSync(absPath).mtimeMs

      if (analyzedMtimes.get(absPath) === mtimeMs) {
        return
      }

      analyzedMtimes.set(absPath, mtimeMs)
      analyzer.setFile({ path: absPath, ext, name, dimension, source: fs.readFileSync(absPath, "utf8") })
    }

    // The definition sources import the `.json` assets, so `emitDefinitionSources`
    // implies definition emission; docs-only configurations emit no definitions.
    const emitDefinitionJson = Boolean(this.emitJson || ds)

    const customJsonName = typeof this.emitJson === "function" ? this.emitJson : undefined

    const jsonName = (file: IAssetFile): string =>
      toPosix(customJsonName ? customJsonName(file) : defaultJsonAssetName(context, file))

    const classPrefix = derivePackageClassPrefix(context)
    const emittedClassNames = {} as Record<Kind, string>
    const dsFileNames = {} as Record<Kind, string>

    for (const kind of this.kinds) {
      emittedClassNames[kind] =
        this.explicitClassNames[kind] ??
        (classPrefix ? `${classPrefix}${DEFINITION_SOURCE_BASE_CLASS[kind]}` : this.sources[kind].className)
      dsFileNames[kind] = toPosix(ds?.fileName?.(kind) ?? `${this.sources[kind].moduleName}.js`)
    }

    const barrelFileName = ds && ds.barrelFileName !== false ? (ds.barrelFileName ?? "definitionsource.js") : undefined

    // Compile results are memoized by mtime so watch rebuilds only recompile edited
    // sources; webpack's compareBeforeEmit skips rewriting unchanged files on disk.
    const compiledJson = new Map<string, { mtimeMs: number; json: string }>()

    const compileJson = async (asset: IAssetFile): Promise<string> => {
      const stat = fs.statSync(asset.absPath)
      const cached = compiledJson.get(asset.absPath)

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.json
      }

      const source = fs.readFileSync(asset.absPath, "utf8")
      const definition = await compileAsset(asset.ext, source, asset.dimension, asset.name)
      const json = JSON.stringify(definition)

      compiledJson.set(asset.absPath, { mtimeMs: stat.mtimeMs, json })

      return json
    }

    const compiledThemeTokens = new Map<string, { mtimeMs: number; tokens: Record<string, string> }>()

    const collectThemeTokens = async (asset: IAssetFile): Promise<Record<string, string>> => {
      const stat = fs.statSync(asset.absPath)
      const cached = compiledThemeTokens.get(asset.absPath)

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.tokens
      }

      const source = fs.readFileSync(asset.absPath, "utf8")
      const definition = (await compileAsset(asset.ext, source, asset.dimension, asset.name)) as IThemeDefinition
      const tokens = flattenThemeTokens(definition.groups)

      compiledThemeTokens.set(asset.absPath, { mtimeMs: stat.mtimeMs, tokens })

      return tokens
    }

    const compiledControls = new Map<string, { mtimeMs: number; controls: string[] }>()

    const collectComponentControls = async (asset: IAssetFile): Promise<string[]> => {
      const stat = fs.statSync(asset.absPath)
      const cached = compiledControls.get(asset.absPath)

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.controls
      }

      const source = fs.readFileSync(asset.absPath, "utf8")
      const definition = (await compileAsset(asset.ext, source, asset.dimension, asset.name)) as IComponentDefinition
      const controls = collectControlNames(definition.children ?? [])

      compiledControls.set(asset.absPath, { mtimeMs: stat.mtimeMs, controls })

      return controls
    }

    const compiledDocs = new Map<string, { mtimeMs: number; entry: IDocsEntry | undefined }>()

    const compileDocsEntry = (asset: IAssetFile): IDocsEntry | undefined => {
      const stat = fs.statSync(asset.absPath)
      const cached = compiledDocs.get(asset.absPath)

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.entry
      }

      const source = fs.readFileSync(asset.absPath, "utf8")
      const entry = compileAssetDocs(asset.ext, source, asset.dimension, asset.name)

      compiledDocs.set(asset.absPath, { mtimeMs: stat.mtimeMs, entry })

      return entry
    }

    const compiledHeaders = new Map<string, { mtimeMs: number; header: IComponentHeader | undefined }>()

    const compileHeaderEntry = (asset: IAssetFile): IComponentHeader | undefined => {
      const stat = fs.statSync(asset.absPath)
      const cached = compiledHeaders.get(asset.absPath)

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.header
      }

      const source = fs.readFileSync(asset.absPath, "utf8")
      const header = compileAssetHeader(asset.ext, source)

      compiledHeaders.set(asset.absPath, { mtimeMs: stat.mtimeMs, header })

      return header
    }

    const packageInfo = metaFile ? readPackageInfo(context) : undefined

    const { webpack } = compiler

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        { name: PLUGIN_NAME, stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        async () => {
          analyzedPaths.clear()

          const byKind = {} as Record<Kind, IAssetFile[]>
          const docsEntries: IDocsEntry[] = []
          const themeTokens: Record<string, string> = {}
          const componentControls = new Map<string, Set<string>>()
          const rawComponents: {
            name: string
            dimension: IAssetFile["dimension"]
            dir: string
            header: IComponentHeader
          }[] = []

          for (const kind of this.kinds) {
            byKind[kind] = []
          }

          for (const { kind, asset } of assets.values()) {
            byKind[kind]?.push(asset)
            // Content edits must re-trigger emission even when nothing imports the file.
            compilation.fileDependencies.add(asset.absPath)

            try {
              analyzerSetFile(asset.absPath, asset.ext, asset.name, asset.dimension)
            } catch {
              // Unreadable sources surface through the loader/emit paths.
            }

            try {
              if (emitDefinitionJson) {
                compilation.emitAsset(jsonName(asset), new webpack.sources.RawSource(await compileJson(asset)))
              }

              if (metaFile) {
                const entry = compileDocsEntry(asset)

                if (entry) {
                  docsEntries.push(entry)
                }

                if (asset.ext === EXT_TEMPLATE) {
                  const header = compileHeaderEntry(asset)

                  if (header) {
                    rawComponents.push({
                      name: asset.name,
                      dimension: asset.dimension,
                      dir: path.dirname(asset.absPath),
                      header,
                    })
                  }

                  const controls = componentControls.get(asset.name) ?? new Set<string>()

                  for (const control of await collectComponentControls(asset)) {
                    controls.add(control)
                  }

                  componentControls.set(asset.name, controls)
                } else if (asset.ext === EXT_THEME) {
                  Object.assign(themeTokens, await collectThemeTokens(asset))
                }
              }
            } catch (error) {
              compilation.errors.push(
                new HeleonixWebpackPluginError(
                  Errors.emitFailure,
                  asset.absPath,
                  (error as Error).message,
                ) as unknown as WebpackError,
              )
            }
          }

          if (metaFile) {
            const converterEntries: IRegistryMetaEntry[] = []
            const actionEntries: IRegistryMetaEntry[] = []
            const qualifierEntries: IQualifierDefinition[] = []

            if (typeHost) {
              const resolver = new TypeResolver(typeHost)

              for (const found of resolver.discover()) {
                if (found.suffixOk) {
                  ;(found.base === "Converter" ? converterEntries : actionEntries).push({
                    name: found.name,
                    params: found.params,
                  })
                }
              }

              for (const found of resolver.qualifiers()) {
                if (found.suffixOk) {
                  qualifierEntries.push({ name: found.name, args: found.args })
                }
              }
            }

            compilation.emitAsset(
              toPosix(metaFile),
              new webpack.sources.RawSource(
                JSON.stringify(
                  buildMeta(
                    {
                      docs: docsEntries,
                      components: resolveComponentEntries(rawComponents, componentControls, typeHost),
                      converters: converterEntries,
                      actions: actionEntries,
                      themeTokens,
                      qualifiers: qualifierEntries,
                    },
                    packageInfo,
                  ),
                ),
              ),
            )
          }

          if (analyzer) {
            for (const knownPath of [...analyzedMtimes.keys()]) {
              if (!analyzedPaths.has(knownPath)) {
                analyzer.removeFile(knownPath)
                analyzedMtimes.delete(knownPath)
              }
            }

            // Per-file compile errors of kind sources already surface from the
            // loader; the analyzer contributes the cross-file findings.
            const loaderCoveredPaths = new Set([...assets.values()].map((entry) => entry.asset.absPath))

            for (const finding of await analyzer.analyze()) {
              if (finding.code.startsWith("HX_COMPILER_") && loaderCoveredPaths.has(finding.file)) {
                continue
              }

              const report = new HeleonixWebpackPluginError(
                Errors.validation,
                `${finding.code}: ${finding.message} (${locate(finding.file, finding.subject)})`,
              ) as unknown as WebpackError

              if (finding.severity === "error" || this.validate?.failOnWarnings) {
                compilation.errors.push(report)
              } else {
                compilation.warnings.push(report)
              }
            }
          }

          if (!ds) {
            return
          }

          // `minimized: true` keeps this build's minimizer away from the emitted
          // modules: they are consumed by *another* build, and minification would strip
          // the webpackChunkName magic comments that build needs for chunk grouping.
          const assetInfo = { minimized: true }

          for (const kind of this.kinds) {
            const dsFile = dsFileNames[kind]
            const content = generateDefinitionSource(kind, emittedClassNames[kind], byKind[kind], {
              loading: this.loading,
              chunkName: this.chunkName,
              importAttributes: ds.jsonImportAttributes,
              request: (file) => relativeRequest(dsFile, jsonName(file)),
            })

            compilation.emitAsset(dsFile, new webpack.sources.RawSource(content), assetInfo)
            compilation.emitAsset(
              declarationFileName(dsFile),
              new webpack.sources.RawSource(generateDefinitionSourceDeclaration(kind, emittedClassNames[kind])),
            )
          }

          if (barrelFileName) {
            // Pure re-exports, so the declaration content matches the module itself:
            // TypeScript maps the `.js` specifiers onto the sibling `.d.ts` files.
            const exports = `${this.kinds
              .map(
                (kind) =>
                  `export { ${emittedClassNames[kind]} } from ${JSON.stringify(
                    relativeRequest(barrelFileName, dsFileNames[kind]),
                  )}`,
              )
              .join("\n")}\n`

            compilation.emitAsset(barrelFileName, new webpack.sources.RawSource(exports), assetInfo)
            compilation.emitAsset(declarationFileName(barrelFileName), new webpack.sources.RawSource(exports))
          }
        },
      )
    })
  }
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Resolves each component's props/events header text into member facts for the
 * meta manifest, so a consuming package validates usages without re-resolving
 * this package's TypeScript sources. Without a type host (no TS project), or for
 * an unresolvable type, only the summary docs are shipped for that component.
 */
function resolveComponentEntries(
  raws: readonly { name: string; dimension: IAssetFile["dimension"]; dir: string; header: IComponentHeader }[],
  controls: ReadonlyMap<string, Set<string>>,
  typeHost: ITypeProgramHost | undefined,
): IComponentMetaEntry[] {
  const requests: { id: string; dir: string; typeText: string }[] = []

  raws.forEach((raw, index) => {
    for (const kind of ["props", "events"] as const) {
      const text = raw.header[kind]

      if (text) {
        requests.push({ id: `${index}|${kind}`, dir: raw.dir, typeText: text })
      }
    }
  })

  const resolved = typeHost && requests.length > 0 ? new TypeResolver(typeHost).resolve(requests) : undefined

  return raws.map((raw, index) => {
    const entry: IComponentMetaEntry = { name: raw.name, dimension: raw.dimension }

    if (raw.header.docs) {
      entry.docs = raw.header.docs
    }

    for (const kind of ["props", "events"] as const) {
      const result = resolved?.get(`${index}|${kind}`)

      if (result?.resolved && result.members.length > 0) {
        entry[kind] = result.members
      }
    }

    const names = controls.get(raw.name)

    if (names && names.size > 0) {
      entry.controls = [...names]
    }

    return entry
  })
}

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, "/")
}

/**
 * Default emitted name for a compiled definition: the source path relative to the
 * compiler context with `.json` appended, keeping the source extension so same-named
 * sources of different kinds never collide (`src/Sandbox.hxc` -> `src/Sandbox.hxc.json`).
 */
function defaultJsonAssetName(context: string, file: IAssetFile): string {
  const relative = path.relative(context, file.absPath)
  const withinContext = !path.isAbsolute(relative) && !relative.startsWith("..")

  return `${toPosix(withinContext ? relative : path.basename(file.absPath))}.json`
}

function declarationFileName(jsFileName: string): string {
  return jsFileName.endsWith(".js") ? `${jsFileName.slice(0, -3)}.d.ts` : `${jsFileName}.d.ts`
}

/** Relative import specifier from one emitted asset to another (both output-relative). */
function relativeRequest(fromFile: string, toFile: string): string {
  const fromDir = path.posix.dirname(fromFile)
  const relative = path.posix.relative(fromDir === "." ? "" : fromDir, toFile)

  return relative.startsWith(".") ? relative : `./${relative}`
}

/**
 * Derives a class-name prefix from the `name` in the package.json at the compiler
 * context (`@acme/ui` -> `AcmeUi`), so definition sources emitted by different library
 * packages get distinct class/DI names by default.
 */
function derivePackageClassPrefix(context: string): string | undefined {
  let name: unknown

  try {
    name = (JSON.parse(fs.readFileSync(path.join(context, "package.json"), "utf8")) as { name?: unknown }).name
  } catch {
    return undefined
  }

  if (typeof name !== "string") {
    return undefined
  }

  const segments = name.split(/[^a-zA-Z0-9]+/).filter(Boolean)

  if (segments.length === 0) {
    return undefined
  }

  return segments.map((segment) => segment[0].toUpperCase() + segment.slice(1)).join("")
}

/** `name`/`version` of the package.json at the compiler context - the docs bundle's envelope. */
function readPackageInfo(context: string): { package?: string; version?: string } | undefined {
  let manifest: { name?: unknown; version?: unknown }

  try {
    manifest = JSON.parse(fs.readFileSync(path.join(context, "package.json"), "utf8")) as typeof manifest
  } catch {
    return undefined
  }

  return {
    ...(typeof manifest.name === "string" ? { package: manifest.name } : {}),
    ...(typeof manifest.version === "string" ? { version: manifest.version } : {}),
  }
}

function writeIfChanged(file: string, content: string): void {
  try {
    if (fs.readFileSync(file, "utf8") === content) {
      return
    }
  } catch {
    // File does not exist yet - fall through to write it.
  }

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

/** `file:line:column` of the finding's subject in the source, or the bare file. */
function locate(file: string, subject: string | undefined): string {
  if (!subject) {
    return file
  }

  let text: string

  try {
    text = fs.readFileSync(file, "utf8")
  } catch {
    return file
  }

  const offset = text.indexOf(subject)

  if (offset === -1) {
    return file
  }

  const before = text.slice(0, offset)
  const line = before.split("\n").length
  const column = offset - before.lastIndexOf("\n")

  return `${file}:${line}:${column}`
}
