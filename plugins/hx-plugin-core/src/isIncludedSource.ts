import path from "node:path"

/**
 * Whether a build compiles a source file, as `scan` finds them: below one of the `include` directories, outside
 * dot-folders and outside `exclude` - folder names skipped wherever they occur below an `include` directory, or
 * paths skipped with everything under them.
 */
export function isIncludedSource(filePath: string, include: readonly string[], exclude: readonly string[]): boolean {
  const file = path.resolve(filePath)
  const root = include.map((dir) => path.resolve(dir)).find((dir) => isWithin(dir, file))

  if (root === undefined) {
    return false
  }

  const folders = path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean)
  const names = new Set(exclude.filter((entry) => !path.isAbsolute(entry) && !/[\\/]/.test(entry)))

  if (folders.some((folder) => folder.startsWith(".") || names.has(folder))) {
    return false
  }

  return !exclude.some((entry) => path.isAbsolute(entry) && isWithin(entry, file))
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)

  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}
