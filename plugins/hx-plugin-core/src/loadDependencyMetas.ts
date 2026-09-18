import fs from "node:fs"
import path from "node:path"
import { META_CONDITION } from "@heleonix/hx-language"
import type { IMetaDocument } from "@heleonix/hx-language"

export function loadDependencyMetas(contextDir: string): IMetaDocument[] {
  const result: IMetaDocument[] = []
  const packageJson = readJson(path.join(contextDir, "package.json")) as
    | { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }
    | undefined

  if (!packageJson) {
    return result
  }

  const names = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ])

  for (const name of names) {
    const packageDir = resolvePackageDir(contextDir, name)

    if (!packageDir) {
      continue
    }

    const manifest = readJson(path.join(packageDir, "package.json")) as { exports?: unknown } | undefined

    for (const target of metaTargets(manifest?.exports)) {
      const meta = readJson(path.resolve(packageDir, target)) as IMetaDocument | undefined

      if (meta && typeof meta === "object" && typeof meta.schemaVersion === "number") {
        result.push(meta)
      }
    }
  }

  return result
}

function metaTargets(exports: unknown, found: Set<string> = new Set()): Set<string> {
  if (!exports || typeof exports !== "object" || Array.isArray(exports)) {
    return found
  }

  for (const [key, value] of Object.entries(exports)) {
    if (key === META_CONDITION && typeof value === "string") {
      found.add(value)
    } else {
      metaTargets(value, found)
    }
  }

  return found
}

function resolvePackageDir(from: string, name: string): string | undefined {
  let current = from

  for (;;) {
    const candidate = path.join(current, "node_modules", name)

    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate
    }

    const parent = path.dirname(current)

    if (parent === current) {
      return undefined
    }

    current = parent
  }
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return undefined
  }
}
