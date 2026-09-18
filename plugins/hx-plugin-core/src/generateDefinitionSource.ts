import type { Kind } from "@heleonix/hx-language"
import { IAssetFile } from "./IAssetFile"
import { IGenerateDefinitionSourceOptions } from "./IGenerateDefinitionSourceOptions"
import { encodeAssetMeta } from "./encodeAssetMeta"
import { DEFINITION_SOURCE_BASE_CLASS } from "./definitionSourceBaseClass"

export function generateDefinitionSource(
  kind: Kind,
  className: string,
  files: readonly IAssetFile[],
  options: IGenerateDefinitionSourceOptions = {},
): string {
  const baseClass = DEFINITION_SOURCE_BASE_CLASS[kind]
  const request = options.request ?? defaultRequest

  // Group definitions by name at build time so the generated module is a plain,
  // static lookup table - no runtime accumulation helper needed. The theme is
  // resolved as a whole rather than by name, so its module keeps a flat list.
  const groups = new Map<string, number[]>()

  files.forEach((file, index) => {
    const indexes = groups.get(file.name)

    if (indexes) {
      indexes.push(index)
    } else {
      groups.set(file.name, [index])
    }
  })

  const aggregate = kind === "theme"

  if (options.loading === "lazy") {
    return generateLazy(
      baseClass,
      className,
      files,
      groups,
      aggregate,
      request,
      options.chunkName,
      options.importAttributes,
    )
  }

  return generateEager(baseClass, className, files, groups, aggregate, request, options.importAttributes)
}

function generateEager(
  baseClass: string,
  className: string,
  files: readonly IAssetFile[],
  groups: ReadonlyMap<string, number[]>,
  aggregate: boolean,
  request: (file: IAssetFile) => string,
  importAttributes?: boolean,
): string {
  const attributes = importAttributes ? ` with { type: "json" }` : ""

  const imports = files
    .map((file, index) => `import _${index} from ${JSON.stringify(request(file))}${attributes}`)
    .join("\n")

  if (aggregate) {
    return `import { ${baseClass} } from "@heleonix/hx-core"
${imports}

const definitions = [${files.map((_file, index) => `_${index}`).join(", ")}]

export class ${className} extends ${baseClass} {
  loadDefinitions(dimension) {
    return Promise.resolve(definitions)
  }
}
`
  }

  const entries = [...groups]
    .map(([name, indexes]) => `  [${JSON.stringify(name)}, [${indexes.map((index) => `_${index}`).join(", ")}]],`)
    .join("\n")

  return `import { ${baseClass} } from "@heleonix/hx-core"
${imports}

const groups = new Map([
${entries}
])

export class ${className} extends ${baseClass} {
  loadDefinitions(name, dimension) {
    return Promise.resolve(groups.get(name) || [])
  }
}
`
}

function generateLazy(
  baseClass: string,
  className: string,
  files: readonly IAssetFile[],
  groups: ReadonlyMap<string, number[]>,
  aggregate: boolean,
  request: (file: IAssetFile) => string,
  chunkName?: (file: IAssetFile) => string | undefined,
  importAttributes?: boolean,
): string {
  const attributes = importAttributes ? `, { with: { type: "json" } }` : ""

  const thunks = files.map((file) => {
    const chunk = chunkName?.(file)
    const comment = chunk === undefined ? "" : `/* webpackChunkName: ${JSON.stringify(chunk)} */ `

    return `() => import(${comment}${JSON.stringify(request(file))}${attributes})`
  })

  // The module cache holds dynamic imports, so repeated loadDefinitions calls for
  // the same name reuse already-loaded modules without extra bookkeeping here.
  if (aggregate) {
    return `import { ${baseClass} } from "@heleonix/hx-core"

const loaders = [${thunks.join(", ")}]

export class ${className} extends ${baseClass} {
  async loadDefinitions(dimension) {
    const modules = await Promise.all(loaders.map((load) => load()))

    return modules.map((module) => module.default)
  }
}
`
  }

  const entries = [...groups]
    .map(([name, indexes]) => `  [${JSON.stringify(name)}, [${indexes.map((index) => thunks[index]).join(", ")}]],`)
    .join("\n")

  return `import { ${baseClass} } from "@heleonix/hx-core"

const groups = new Map([
${entries}
])

export class ${className} extends ${baseClass} {
  async loadDefinitions(name, dimension) {
    const loaders = groups.get(name)

    if (!loaders) {
      return []
    }

    const modules = await Promise.all(loaders.map((load) => load()))

    return modules.map((module) => module.default)
  }
}
`
}

function defaultRequest(file: IAssetFile): string {
  return toPosix(file.absPath) + encodeAssetMeta({ name: file.name, dimension: file.dimension, ext: file.ext })
}

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, "/")
}
