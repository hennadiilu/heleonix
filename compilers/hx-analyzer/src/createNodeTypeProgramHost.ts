import path from "node:path"
import ts from "typescript"
import type { ITypeProgramHost } from "./ITypeProgramHost"

/**
 * Builds a disk-backed {@link ITypeProgramHost} for Node hosts (build plugins,
 * the language server): reads `tsconfig.json` (falling back to sane options)
 * and serves source/lib files from the filesystem via TypeScript's own host.
 *
 * This is the only filesystem-touching part of the analyzer. A browser host
 * (StackBlitz, etc.) provides an equivalent {@link ITypeProgramHost} backed by
 * an in-memory virtual filesystem instead, and `TypeResolver` runs unchanged.
 */
export function createNodeTypeProgramHost(projectRoot: string): ITypeProgramHost {
  const configPath = ts.findConfigFile(projectRoot, (file) => ts.sys.fileExists(file), "tsconfig.json")

  let options: ts.CompilerOptions
  let rootFiles: readonly string[]

  if (configPath) {
    const config = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file))
    const parsed = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, path.dirname(configPath))

    options = { ...parsed.options, noEmit: true, skipLibCheck: true }
    rootFiles = parsed.fileNames
  } else {
    options = {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ["lib.es2020.d.ts"],
      skipLibCheck: true,
    }
    rootFiles = []
  }

  return { options, rootFiles, host: withSourceFileCache(ts.createCompilerHost(options, true)) }
}

/**
 * Wraps a compiler host so parsed source files are cached by path and reused
 * across program creations, invalidated by modification time. The host is
 * long-lived (one per project), so this avoids re-parsing the standard library
 * and unchanged project files on every analysis, while a saved edit (new mtime)
 * is re-read. The dominant cost of a fresh program is parsing `lib.*.d.ts`; the
 * cache removes it from the second analysis onward.
 */
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
