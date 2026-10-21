import fs from "node:fs"
import path from "node:path"
import { globToRegExp } from "./globToRegExp"

const CONFIG_FILE = "tsconfig.json"
const GLOB_CHARS = /[*?{]/

/**
 * The `tsconfig` files a root names through `patterns`, relative to it: a literal path (a file, or a folder holding
 * a `tsconfig.json`) as given; a glob pattern against the root's JSON files outside `excludeDirs` and dot-folders.
 * Outermost first.
 */
export function findTypeProjects(
  root: string,
  patterns: readonly string[],
  excludeDirs: ReadonlySet<string> = new Set(["node_modules"]),
): string[] {
  const found = new Set<string>()
  const globs = patterns.filter((pattern) => GLOB_CHARS.test(pattern)).map(globToRegExp)

  for (const pattern of patterns.filter((candidate) => !GLOB_CHARS.test(candidate))) {
    const target = path.resolve(root, pattern)
    const configPath = isDirectory(target) ? path.join(target, CONFIG_FILE) : target

    if (fs.existsSync(configPath)) {
      found.add(configPath)
    }
  }

  if (globs.length > 0) {
    for (const file of jsonFiles(root, excludeDirs)) {
      if (globs.some((glob) => glob.test(path.relative(root, file).split(path.sep).join("/")))) {
        found.add(file)
      }
    }
  }

  return [...found].sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b))
}

function jsonFiles(dir: string, excludeDirs: ReadonlySet<string>, result: string[] = []): string[] {
  let entries: fs.Dirent[]

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return result
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || excludeDirs.has(entry.name)) {
      continue
    }

    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      jsonFiles(full, excludeDirs, result)
    } else if (entry.name.endsWith(".json")) {
      result.push(full)
    }
  }

  return result
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

function depthOf(file: string): number {
  return path.resolve(file).split(path.sep).length
}
