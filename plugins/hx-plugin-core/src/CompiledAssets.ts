import fs from "node:fs"
import type { IComponentHeader, IDocsEntry } from "@heleonix/hx-language"
import { compileAsset } from "./compileAsset"
import { compileAssetDocs } from "./compileAssetDocs"
import { compileAssetHeader } from "./compileAssetHeader"
import type { IAssetFile } from "./IAssetFile"

interface ICached<T> {
  readonly mtimeMs: number

  readonly value: T
}

/**
 * A package's sources compiled once per change - their definitions, docs and component headers - so a rebuild
 * recompiles only the files edited since.
 */
export class CompiledAssets {
  private readonly definitions = new Map<string, ICached<Promise<unknown>>>()

  private readonly docsEntries = new Map<string, ICached<IDocsEntry | undefined>>()

  private readonly headers = new Map<string, ICached<IComponentHeader | undefined>>()

  public definition(asset: IAssetFile): Promise<unknown> {
    return cached(this.definitions, asset, (source) => compileAsset(asset.ext, source, asset.dimension, asset.name))
  }

  public docs(asset: IAssetFile): IDocsEntry | undefined {
    return cached(this.docsEntries, asset, (source) => compileAssetDocs(asset.ext, source, asset.dimension, asset.name))
  }

  public header(asset: IAssetFile): IComponentHeader | undefined {
    return cached(this.headers, asset, (source) => compileAssetHeader(asset.ext, source))
  }
}

function cached<T>(cache: Map<string, ICached<T>>, asset: IAssetFile, compile: (source: string) => T): T {
  const mtimeMs = fs.statSync(asset.absPath).mtimeMs
  const hit = cache.get(asset.absPath)

  if (hit && hit.mtimeMs === mtimeMs) {
    return hit.value
  }

  const value = compile(fs.readFileSync(asset.absPath, "utf8"))

  cache.set(asset.absPath, { mtimeMs, value })

  return value
}
