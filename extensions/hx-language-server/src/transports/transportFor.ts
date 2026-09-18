import path from "node:path"
import { fileURLToPath } from "node:url"
import { IDefinitionTransport } from "./IDefinitionTransport"
import { FileDefinitionTransport } from "./FileDefinitionTransport"
import { HttpDefinitionTransport } from "./HttpDefinitionTransport"
import { ModuleDefinitionTransport } from "./ModuleDefinitionTransport"
import { PackageDefinitionTransport } from "./PackageDefinitionTransport"

const MODULE_EXTS = new Set([".js", ".mjs", ".cjs"])

export function transportFor(uri: string, root: string, trusted: boolean): IDefinitionTransport | undefined {
  if (/^https?:\/\//i.test(uri)) {
    return new HttpDefinitionTransport(uri)
  }

  if (/^file:\/\//i.test(uri)) {
    return fromPath(fileURLToPath(uri), trusted)
  }

  if (path.isAbsolute(uri) || uri.startsWith(".")) {
    return fromPath(path.resolve(root, uri), trusted)
  }

  return new PackageDefinitionTransport(uri, root)
}

function fromPath(absolutePath: string, trusted: boolean): IDefinitionTransport | undefined {
  if (MODULE_EXTS.has(path.extname(absolutePath).toLowerCase())) {
    return trusted ? new ModuleDefinitionTransport(absolutePath) : undefined
  }

  return new FileDefinitionTransport(absolutePath)
}
