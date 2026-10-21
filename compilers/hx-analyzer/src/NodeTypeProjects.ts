import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { globToRegExp } from "./globToRegExp"
import type { ITypeProgramHost } from "./ITypeProgramHost"

const CONFIG_FILE = "tsconfig.json"

const DEFAULT_OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2020.d.ts"],
}

interface IProjectEntry {
  readonly host?: ITypeProgramHost

  readonly references: readonly string[]
}

/**
 * The program hosts of TypeScript projects, created once per `tsconfig` and shared by every caller - so callers
 * reading the same project share its parsed source files.
 */
export class NodeTypeProjects {
  private readonly roots: readonly string[]

  private readonly exclude: readonly RegExp[]

  private readonly entries = new Map<string, IProjectEntry>()

  private readonly defaults = new Map<string, ITypeProgramHost>()

  /**
   * @param options.roots The folders `exclude` patterns are relative to (a file outside them: to its project).
   * @param options.exclude Glob patterns of source files left out of every project.
   */
  public constructor(options: { roots?: readonly string[]; exclude?: readonly string[] } = {}) {
    this.roots = (options.roots ?? []).map((root) => path.resolve(root))
    this.exclude = (options.exclude ?? []).map(globToRegExp)
  }

  /**
   * A `tsconfig`'s project and the projects it references, transitively - outermost first. A solution-style config
   * (references only) contributes just its references; a project whose files are all excluded, nothing.
   */
  public hostsOf(configPath: string): ITypeProgramHost[] {
    const hosts: ITypeProgramHost[] = []
    const visited = new Set<string>()

    const visit = (current: string): void => {
      const key = realPath(current)

      if (visited.has(key)) {
        return
      }

      visited.add(key)

      const entry = this.entryOf(key)

      if (entry.host) {
        hosts.push(entry.host)
      }

      for (const reference of entry.references) {
        visit(reference)
      }
    }

    visit(configPath)

    return hosts
  }

  /** The project of a directory no pattern names: its nearest `tsconfig.json` above, else default options there. */
  public fallbackOf(dir: string): ITypeProgramHost[] {
    const configPath = ts.findConfigFile(dir, (file) => ts.sys.fileExists(file), CONFIG_FILE)

    if (configPath) {
      return this.hostsOf(configPath)
    }

    const key = path.resolve(dir)
    let host = this.defaults.get(key)

    if (!host) {
      host = createHost(DEFAULT_OPTIONS, [], key)
      this.defaults.set(key, host)
    }

    return [host]
  }

  private entryOf(configPath: string): IProjectEntry {
    let entry = this.entries.get(configPath)

    if (entry) {
      return entry
    }

    const config = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file))
    const parsed = ts.parseJsonConfigFileContent(
      config.config ?? {},
      ts.sys,
      path.dirname(configPath),
      undefined,
      configPath,
    )
    const references = (parsed.projectReferences ?? [])
      .map((reference) => ts.resolveProjectReferencePath(reference))
      .filter((reference) => fs.existsSync(reference))
    const files = parsed.fileNames.filter((file) => !this.isExcluded(file, path.dirname(configPath)))
    const own = parsed.fileNames.length === 0 ? references.length === 0 : files.length > 0

    entry = { references, ...(own ? { host: createHost(parsed.options, files, path.dirname(configPath)) } : {}) }
    this.entries.set(configPath, entry)

    return entry
  }

  private isExcluded(file: string, projectDir: string): boolean {
    if (this.exclude.length === 0) {
      return false
    }

    const resolved = path.resolve(file)
    const base = this.roots.find((root) => isWithin(root, resolved)) ?? projectDir
    const relative = path.relative(base, resolved).split(path.sep).join("/")

    return this.exclude.some((pattern) => pattern.test(relative))
  }
}

function createHost(options: ts.CompilerOptions, rootFiles: readonly string[], projectDir: string): ITypeProgramHost {
  const programOptions = { ...options, noEmit: true, skipLibCheck: true }

  return {
    options: programOptions,
    rootFiles,
    host: withSourceFileCache(ts.createCompilerHost(programOptions, true)),
    projectDir: path.resolve(projectDir),
  }
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)

  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function realPath(target: string): string {
  try {
    return fs.realpathSync.native(target)
  } catch {
    return path.resolve(target)
  }
}

function withSourceFileCache(base: ts.CompilerHost): ts.CompilerHost {
  const cache = new Map<string, { mtimeMs: number; file: ts.SourceFile | undefined }>()
  const getSourceFile = base.getSourceFile.bind(base)

  return {
    ...base,
    getSourceFile: (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
      if (shouldCreateNewSourceFile) {
        return getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile)
      }

      const mtimeMs = ts.sys.getModifiedTime?.(fileName)?.getTime() ?? 0
      const cached = cache.get(fileName)

      if (cached && cached.mtimeMs === mtimeMs) {
        return cached.file
      }

      const file = getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile)

      cache.set(fileName, { mtimeMs, file })

      return file
    },
  }
}
