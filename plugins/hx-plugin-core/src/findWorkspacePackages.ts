import fs from "node:fs"
import path from "node:path"
import { globToRegExp } from "@heleonix/hx-analyzer"

const PACKAGE_FILE = "package.json"

/**
 * The package directories a workspace root declares - through `pnpm-workspace.yaml` (pnpm), the `workspaces` of
 * its `package.json` (npm, yarn, bun) or `lerna.json` - the root itself included when it is a package. `undefined`
 * when the root declares no workspace, leaving its packages to be found by other means.
 */
export function findWorkspacePackages(
  root: string,
  excludeDirs: ReadonlySet<string> = new Set(["node_modules"]),
): string[] | undefined {
  const patterns = workspacePatterns(root)

  if (!patterns) {
    return undefined
  }

  const includes = patterns.filter((pattern) => !pattern.startsWith("!")).map((pattern) => globToRegExp(trim(pattern)))
  const excludes = patterns.filter((pattern) => pattern.startsWith("!")).map((pattern) => globToRegExp(trim(pattern)))
  const found = fs.existsSync(path.join(root, PACKAGE_FILE)) ? [path.resolve(root)] : []

  const walk = (dir: string): void => {
    let entries: fs.Dirent[]

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || excludeDirs.has(entry.name)) {
        continue
      }

      const full = path.join(dir, entry.name)
      const relative = path.relative(root, full).split(path.sep).join("/")

      if (
        fs.existsSync(path.join(full, PACKAGE_FILE)) &&
        includes.some((pattern) => pattern.test(relative)) &&
        !excludes.some((pattern) => pattern.test(relative))
      ) {
        found.push(full)
      }

      walk(full)
    }
  }

  walk(root)

  return found
}

function workspacePatterns(root: string): string[] | undefined {
  const pnpm = readText(path.join(root, "pnpm-workspace.yaml"))

  if (pnpm !== undefined) {
    return yamlList(pnpm, "packages") ?? []
  }

  const manifest = readJson(path.join(root, PACKAGE_FILE)) as { workspaces?: unknown } | undefined
  const workspaces = manifest?.workspaces
  const declared = Array.isArray(workspaces) ? workspaces : (workspaces as { packages?: unknown } | undefined)?.packages

  if (Array.isArray(declared)) {
    return declared.filter((pattern): pattern is string => typeof pattern === "string")
  }

  const lerna = (readJson(path.join(root, "lerna.json")) as { packages?: unknown } | undefined)?.packages

  return Array.isArray(lerna) ? lerna.filter((pattern): pattern is string => typeof pattern === "string") : undefined
}

// The string items of a top-level YAML key, written as a block list (`- "a"`) or
// a flow list (`[a, "b"]`) - all a workspace manifest needs.
function yamlList(source: string, key: string): string[] | undefined {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex((line) => new RegExp(`^${key}\\s*:`).test(line))

  if (start < 0) {
    return undefined
  }

  const inline = lines[start].slice(lines[start].indexOf(":") + 1).trim()

  if (inline.startsWith("[")) {
    return inline
      .replace(/^\[|\]\s*(#.*)?$/g, "")
      .split(",")
      .map(unquote)
      .filter(Boolean)
  }

  const items: string[] = []

  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && !line.startsWith("#")) {
      break
    }

    const item = /^\s*-\s*(.+?)\s*(#.*)?$/.exec(line)

    if (item) {
      items.push(unquote(item[1]))
    }
  }

  return items
}

function unquote(value: string): string {
  return value.trim().replace(/^(["'])(.*)\1$/, "$2")
}

function trim(pattern: string): string {
  return pattern.replace(/^!/, "").replace(/^\.\//, "").replace(/\/$/, "")
}

function readText(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8")
  } catch {
    return undefined
  }
}

function readJson(file: string): unknown {
  const text = readText(file)

  try {
    return text === undefined ? undefined : JSON.parse(text)
  } catch {
    return undefined
  }
}
