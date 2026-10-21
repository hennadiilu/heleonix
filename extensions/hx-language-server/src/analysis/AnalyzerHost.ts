import fs from "node:fs"
import path from "node:path"
import { Diagnostic } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Analyzer, NodeTypeProjects, RUNTIME_PACKAGE, findTypeProjects } from "@heleonix/hx-analyzer"
import { findWorkspacePackages, loadDependencyMetas } from "@heleonix/hx-plugin-core"
import type { IAnalyzerFile, IDiagnostic, ITypeProgramHost } from "@heleonix/hx-analyzer"
import type { IMetaDocument } from "@heleonix/hx-language"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_STYLE, EXT_TEMPLATE, EXT_THEME } from "@heleonix/hx-language"
import { PackageGraph } from "../packages/PackageGraph"
import type { IPackageNode } from "../packages/IPackageNode"
import type { IPackageScope } from "../packages/IPackageScope"
import { WorkspaceConfigs } from "../settings/WorkspaceConfigs"
import { toDiagnosticSeverity } from "../lsp/toDiagnosticSeverity"
import type { IAnalyzerSnapshot } from "./IAnalyzerSnapshot"

export const ANALYZER_EXTS = new Set([EXT_TEMPLATE, EXT_DICTIONARY, EXT_CONFIG, EXT_STYLE, EXT_THEME])

const PACKAGE_FILE = "package.json"
const CONFIG_FILE = "tsconfig.json"

// A package scope analyzed the way the package's own build validates it: its
// packages' `.hx*` files and TypeScript projects, and the manifests of what they
// install. Built on first use; each analysis runs after the previous one.
interface IScope {
  readonly packages: IPackageScope

  readonly analyzer: Analyzer

  version: number

  analysis?: { readonly version: number; readonly findings: Promise<IDiagnostic[]> }
}

export class AnalyzerHost {
  private roots: readonly string[] = []

  private exclude: ReadonlySet<string> = new Set()

  // Every `.hx*` file of the workspace, read once; a scope takes its own.
  private readonly files = new Map<string, string>()

  // Manifests from configured definition sources, offered to every scope.
  private readonly extraMetas: IMetaDocument[] = []

  private graph = new PackageGraph([], [], false)

  private tsconfigs: readonly string[] = []

  private projects = new NodeTypeProjects()

  // The TypeScript settings `projects` was made for: a reseed under unchanged ones
  // (a configuration edit) keeps its parsed projects and source files.
  private projectsKey = ""

  private readonly dependencyMetas = new Map<string, readonly IMetaDocument[]>()

  private readonly scopes = new Map<string, IScope>()

  // Each file is read the way its build reads it: only the sources its
  // `hx.config.json` compiles, named under its dimensions, at its levels.
  public constructor(private readonly configs: WorkspaceConfigs = new WorkspaceConfigs()) {}

  public seed(roots: readonly string[], exclude: ReadonlySet<string>): void {
    this.roots = roots
    this.exclude = exclude
    this.files.clear()
    this.loadProjects(this.packageDirsOf(true), false)
  }

  // Re-reads the packages and TypeScript projects - a `package.json`, a
  // `tsconfig` or the installed dependencies changed. Scopes rebuild on next use.
  public reloadProjects(): void {
    this.loadProjects(this.packageDirsOf(false), true)
  }

  public addMeta(meta: IMetaDocument): void {
    const reloaded = meta.package === undefined ? -1 : this.extraMetas.findIndex((extra) => isSameRelease(extra, meta))

    if (reloaded >= 0) {
      this.extraMetas[reloaded] = meta
    } else {
      this.extraMetas.push(meta)
    }

    for (const scope of this.scopes.values()) {
      for (const live of this.withoutLiveContracts(meta)) {
        scope.analyzer.addMeta(live)
      }

      scope.version += 1
    }
  }

  // A TypeScript source changed: each scope's next analysis re-scans its
  // projects, whose programs re-read only files modified since.
  public typesChanged(): void {
    for (const scope of this.scopes.values()) {
      scope.version += 1
    }
  }

  // The directories to watch for TypeScript sources and projects, outermost
  // only: the roots and the packages linked in from outside them.
  public typeProjectDirs(): string[] {
    const external = this.graph.externalPackages().map((node) => node.dir)
    const dirs = [...new Set([...this.roots, ...external].map((dir) => path.resolve(dir)))].sort()

    return dirs.filter((dir) => !dirs.some((other) => other !== dir && isWithin(other, dir)))
  }

  /** The packages a file can see - its owning package's scope, or the whole workspace. */
  public packageScope(filePath?: string): IPackageScope {
    return this.graph.scopeOf(filePath)
  }

  /** The contracts a file can use, analyzing its scope first when stale. */
  public async snapshot(filePath?: string): Promise<IAnalyzerSnapshot> {
    const scope = this.scopeOf(filePath)

    await this.analyze(scope).catch(() => [])

    return {
      converters: scope.analyzer.converters(),
      actions: scope.analyzer.actions(),
      components: scope.analyzer.components(),
      themeTokens: scope.analyzer.themeTokens(),
      qualifiers: scope.analyzer.qualifiers(),
      controlNames: scope.analyzer.controlNames(),
    }
  }

  /** Drops the scopes no open file belongs to. */
  public retain(openFiles: Iterable<string>): void {
    const kept = new Set([...openFiles].map((file) => this.graph.scopeOf(file).key))

    for (const key of [...this.scopes.keys()]) {
      if (!kept.has(key)) {
        this.scopes.delete(key)
      }
    }
  }

  public update(filePath: string, text: string | undefined): void {
    let source = text

    if (!this.configs.compiles(filePath)) {
      this.remove(filePath)

      return
    }

    if (source === undefined) {
      try {
        source = fs.readFileSync(filePath, "utf8")
      } catch {
        this.remove(filePath)

        return
      }
    }

    this.files.set(filePath, source)

    for (const scope of this.scopes.values()) {
      if (scope.packages.contains(filePath)) {
        scope.analyzer.setFile(this.analyzerFile(filePath, source))
        scope.version += 1
      }
    }
  }

  public remove(filePath: string): void {
    this.files.delete(filePath)

    for (const scope of this.scopes.values()) {
      if (scope.packages.contains(filePath)) {
        scope.analyzer.removeFile(filePath)
        scope.version += 1
      }
    }
  }

  public async diagnosticsFor(filePath: string, document: TextDocument): Promise<Diagnostic[]> {
    const findings = await this.analyze(this.scopeOf(filePath))
    const result: Diagnostic[] = []
    const text = document.getText()

    for (const finding of findings) {
      if (finding.file !== filePath) {
        continue
      }

      if (finding.code.startsWith("HX_COMPILER_")) {
        continue
      }

      const severity = toDiagnosticSeverity(this.configs.levelOf(finding.code, finding.severity, filePath))

      if (severity === undefined) {
        continue
      }

      for (const range of rangesOf(text, finding, document)) {
        result.push({
          range,
          severity,
          code: finding.code,
          source: "heleonix",
          message: finding.message,
        })
      }
    }

    return result
  }

  // Each root's packages: those its workspace manifest declares, else every
  // folder holding a `package.json` - walking the roots (reading their sources) either way.
  private packageDirsOf(readSources: boolean): string[] {
    return this.roots.flatMap((root) => {
      const walked: string[] = []

      this.walk(root, walked, readSources)

      return findWorkspacePackages(root, this.exclude) ?? walked
    })
  }

  private loadProjects(packageDirs: readonly string[], fresh: boolean): void {
    const typescript = this.roots.map((root) => this.configs.typescriptOf(root))

    this.graph = new PackageGraph(
      this.roots,
      packageDirs,
      typescript.some((settings) => settings.linkedPackages),
    )
    this.tsconfigs = typescript.flatMap(({ projects }) =>
      projects.patterns.length > 0 ? findTypeProjects(projects.base, projects.patterns, this.exclude) : [],
    )

    const projectOptions = {
      roots: typescript.map(({ exclude }) => exclude.base),
      exclude: typescript.flatMap(({ exclude }) => exclude.patterns),
    }
    const key = JSON.stringify(projectOptions)

    if (fresh || key !== this.projectsKey) {
      this.projects = new NodeTypeProjects(projectOptions)
      this.projectsKey = key
    }

    this.dependencyMetas.clear()
    this.scopes.clear()
  }

  private scopeOf(filePath?: string): IScope {
    const packages = this.graph.scopeOf(filePath)
    let scope = this.scopes.get(packages.key)

    if (!scope) {
      const analyzer = new Analyzer()

      for (const [file, source] of this.files) {
        if (packages.contains(file)) {
          analyzer.setFile(this.analyzerFile(file, source))
        }
      }

      analyzer.setTypeProgramHosts(this.hostsOf(packages), this.discoverableIn(packages))

      for (const meta of this.metasOf(packages)) {
        analyzer.addMeta(meta)
      }

      scope = { packages, analyzer, version: 0 }
      this.scopes.set(packages.key, scope)
    }

    return scope
  }

  private analyze(scope: IScope): Promise<IDiagnostic[]> {
    if (scope.analysis?.version !== scope.version) {
      const previous = scope.analysis?.findings.catch(() => []) ?? Promise.resolve([])

      scope.analysis = { version: scope.version, findings: previous.then(() => scope.analyzer.analyze()) }
    }

    return scope.analysis.findings
  }

  // Each package's own projects (those a `projects` pattern found inside it),
  // else the project governing its folder; a linked package's own `tsconfig`.
  private hostsOf(packages: IPackageScope): ITypeProgramHost[] {
    const hosts: ITypeProgramHost[] = []

    const add = (found: readonly ITypeProgramHost[]): void => {
      for (const host of found) {
        if (!hosts.includes(host)) {
          hosts.push(host)
        }
      }
    }

    if (packages.key === "") {
      for (const config of this.tsconfigs) {
        add(this.projects.hostsOf(config))
      }

      for (const root of this.roots) {
        if (!this.tsconfigs.some((config) => isWithin(root, config))) {
          add(this.projects.fallbackOf(root))
        }
      }
    }

    for (const node of packages.packages) {
      if (node.external) {
        add(this.externalHostsOf(node))
      } else if (packages.key !== "") {
        const own = this.tsconfigs.filter((config) => this.graph.ownerOf(config) === node)

        add(
          own.length > 0 ? own.flatMap((config) => this.projects.hostsOf(config)) : this.projects.fallbackOf(node.dir),
        )
      }
    }

    return hosts
  }

  // The sources whose classes a scope sees: its own package's, and those of the
  // dependencies that can declare a class at all - only the runtime declaring
  // the bases, or a package reaching it, can. Other projects are never built.
  private discoverableIn(packages: IPackageScope): ((fileName: string) => boolean) | undefined {
    if (packages.key === "") {
      return undefined
    }

    const declaring = new Set(
      packages.packages.filter((node, index) => index === 0 || this.graph.reaches(node, RUNTIME_PACKAGE)),
    )

    return (fileName) => {
      const node = this.graph.packageOf(fileName)

      return node !== undefined && declaring.has(node)
    }
  }

  private externalHostsOf(node: IPackageNode): ITypeProgramHost[] {
    const configPath = path.join(node.dir, CONFIG_FILE)

    return fs.existsSync(configPath) ? this.projects.hostsOf(configPath) : []
  }

  // The manifests of what the scope's packages install, each package version
  // once, plus those of configured definition sources.
  private metasOf(packages: IPackageScope): IMetaDocument[] {
    const metas: IMetaDocument[] = []

    for (const node of packages.packages) {
      for (const meta of this.dependencyMetasOf(node.dir)) {
        if (meta.package === undefined || !metas.some((other) => isSameRelease(other, meta))) {
          metas.push(meta)
        }
      }
    }

    return [...metas, ...this.extraMetas].flatMap((meta) => this.withoutLiveContracts(meta))
  }

  private dependencyMetasOf(dir: string): readonly IMetaDocument[] {
    let metas = this.dependencyMetas.get(dir)

    if (!metas) {
      try {
        metas = loadDependencyMetas(dir)
      } catch {
        // Dependency metadata only adds precision - never fail on it.
        metas = []
      }

      this.dependencyMetas.set(dir, metas)
    }

    return metas
  }

  // A manifest describes sources the workspace may read directly: a workspace
  // package's are read whole, a linked package's TypeScript contracts too.
  private withoutLiveContracts(meta: IMetaDocument): IMetaDocument[] {
    if (meta.package === undefined) {
      return [meta]
    }

    if (this.graph.packageNames(false).has(meta.package)) {
      return []
    }

    if (this.graph.packageNames(true).has(meta.package)) {
      return [{ ...meta, converters: undefined, actions: undefined, qualifiers: undefined }]
    }

    return [meta]
  }

  private analyzerFile(filePath: string, source: string): IAnalyzerFile {
    return { path: filePath, ext: path.extname(filePath).toLowerCase(), ...this.configs.assetOf(filePath), source }
  }

  private walk(dir: string, packageDirs: string[], readSources: boolean): void {
    let entries: fs.Dirent[]

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || this.exclude.has(entry.name)) {
        continue
      }

      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        this.walk(full, packageDirs, readSources)
      } else if (entry.name === PACKAGE_FILE) {
        packageDirs.push(dir)
      } else if (
        readSources &&
        ANALYZER_EXTS.has(path.extname(entry.name).toLowerCase()) &&
        this.configs.compiles(full)
      ) {
        this.update(full, undefined)
      }
    }
  }
}

function isSameRelease(a: IMetaDocument, b: IMetaDocument): boolean {
  return a.package === b.package && a.version === b.version
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, path.resolve(child))

  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function rangesOf(
  text: string,
  finding: IDiagnostic,
  document: TextDocument,
): { start: { line: number; character: number }; end: { line: number; character: number } }[] {
  const subject = finding.subject

  if (!subject) {
    return [{ start: document.positionAt(0), end: document.positionAt(0) }]
  }

  const result = []

  for (let from = text.indexOf(subject); from !== -1; from = text.indexOf(subject, from + subject.length)) {
    result.push({ start: document.positionAt(from), end: document.positionAt(from + subject.length) })
  }

  return result.length > 0 ? result : [{ start: document.positionAt(0), end: document.positionAt(0) }]
}
