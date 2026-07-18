import path from "node:path"
import { fileURLToPath } from "node:url"
import { DefinitionLoader } from "./DefinitionLoader"
import { FileDefinitionLoader } from "./FileDefinitionLoader"
import { HttpDefinitionLoader } from "./HttpDefinitionLoader"
import { ModuleDefinitionLoader } from "./ModuleDefinitionLoader"
import { PackageDefinitionLoader } from "./PackageDefinitionLoader"

const MODULE_EXTS = new Set([".js", ".mjs", ".cjs"])

/**
 * Picks the transport for one `heleonix.definitionSources` entry by its shape:
 *
 *   - `http(s)://…`                    -> {@link HttpDefinitionLoader}
 *   - `file://…`, absolute, or `./…`   -> a local path (see below)
 *   - anything else (`@acme/widgets`)  -> {@link PackageDefinitionLoader}
 *
 * A local path ending in `.js`/`.mjs`/`.cjs` is a custom {@link ModuleDefinitionLoader}
 * (workspace code); any other path is a {@link FileDefinitionLoader} (a compiled
 * `.json` manifest or a directory of them). Relative paths resolve against `root`.
 *
 * Returns `undefined` for a module entry when `trusted` is false, so the server
 * can skip (and report) code-executing sources in untrusted workspaces.
 */
export function loaderFor(uri: string, root: string, trusted: boolean): DefinitionLoader | undefined {
  if (/^https?:\/\//i.test(uri)) {
    return new HttpDefinitionLoader(uri)
  }

  if (/^file:\/\//i.test(uri)) {
    return fromPath(fileURLToPath(uri), trusted)
  }

  if (path.isAbsolute(uri) || uri.startsWith(".")) {
    return fromPath(path.resolve(root, uri), trusted)
  }

  return new PackageDefinitionLoader(uri, root)
}

function fromPath(absolutePath: string, trusted: boolean): DefinitionLoader | undefined {
  if (MODULE_EXTS.has(path.extname(absolutePath).toLowerCase())) {
    return trusted ? new ModuleDefinitionLoader(absolutePath) : undefined
  }

  return new FileDefinitionLoader(absolutePath)
}
