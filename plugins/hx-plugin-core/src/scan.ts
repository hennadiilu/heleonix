import fs from "node:fs"
import path from "node:path"
import { HeleonixPluginError } from "./errors/HeleonixPluginError"
import { Errors } from "./errors/Errors"

/**
 * Recursively collects every file under `dirs` whose extension is in `exts`.
 *
 * Each `exclude` entry is skipped during the walk and is interpreted as either:
 *   - a bare folder name (no path separator) - skipped wherever it appears in the
 *     tree, e.g. `"node_modules"`; or
 *   - a folder path - absolute, or relative to `baseDir`.
 *
 * Hidden entries (names starting with `.`) are always skipped.
 *
 * A missing top-level `dirs` entry is a configuration mistake and throws; any other
 * read failure (e.g. permissions) is surfaced rather than silently ignored. A nested
 * directory that disappears mid-walk is the only case skipped quietly.
 */
export function scan(
  dirs: readonly string[],
  exts: ReadonlySet<string>,
  exclude: readonly string[],
  baseDir: string,
): string[] {
  const excludeNames = new Set<string>()
  const excludePaths = new Set<string>()

  for (const item of exclude) {
    if (path.isAbsolute(item) || item.includes("/") || item.includes("\\")) {
      excludePaths.add(path.resolve(baseDir, item))
    } else {
      excludeNames.add(item)
    }
  }

  const result: string[] = []

  for (const dir of dirs) {
    walk(dir, exts, excludeNames, excludePaths, result, true)
  }

  return result
}

function walk(
  dir: string,
  exts: ReadonlySet<string>,
  excludeNames: ReadonlySet<string>,
  excludePaths: ReadonlySet<string>,
  out: string[],
  isTopLevel: boolean,
): void {
  let entries: fs.Dirent[]

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code

    if (code === "ENOENT") {
      // A missing include root is almost always a misconfiguration; a nested dir
      // vanishing between readdir and recursion is a benign race.
      if (isTopLevel) {
        throw new HeleonixPluginError(Errors.includeDirNotFound, dir)
      }

      return
    }

    throw error
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue
    }

    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (!excludeNames.has(entry.name) && !excludePaths.has(full)) {
        walk(full, exts, excludeNames, excludePaths, out, false)
      }
    } else if (exts.has(path.extname(entry.name))) {
      out.push(full)
    }
  }
}
