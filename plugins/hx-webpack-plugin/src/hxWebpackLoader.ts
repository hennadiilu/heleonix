import type { LoaderContext } from "webpack"
import {
  parseAssetFileName,
  decodeAssetMeta,
  isSkipped,
  compileAsset,
  type IParsedAssetFileName,
} from "@heleonix/hx-plugin-core"
import { IHxWebpackLoaderOptions } from "./IHxWebpackLoaderOptions"
import { HeleonixWebpackPluginError } from "./errors/HeleonixWebpackPluginError"
import { Errors } from "./errors/Errors"

export default function hxWebpackLoader(this: LoaderContext<IHxWebpackLoaderOptions>, source: string): void {
  const callback = this.async()

  if (this.cacheable) {
    this.cacheable(true)
  }

  const { dimensions = [] } = this.getOptions() || {}

  let parsed: IParsedAssetFileName

  try {
    // The plugin already parsed the file name and forwarded the result on the
    // request query, so the common path avoids re-parsing. Direct imports that
    // bypass the plugin have no query and fall back to parsing here.
    const meta = decodeAssetMeta(this.resourceQuery)

    if (meta) {
      parsed = meta
    } else {
      const result = parseAssetFileName(this.resourcePath, dimensions)

      // Outside this build's configured dimensions: the plugin won't import it, but
      // guard direct imports so the source doesn't get compiled into the bundle. Unlike
      // the plugin's own scan, a direct import is deliberate, so warn rather than drop it
      // silently - almost always the app is missing the dimension value the file uses.
      if (isSkipped(result)) {
        this.emitWarning(
          new HeleonixWebpackPluginError(Errors.skippedDirectImport, this.resourcePath, result.unmatchedSegment),
        )
        callback(null, "export default null\n")
        return
      }

      parsed = result
    }
  } catch (error) {
    callback(new HeleonixWebpackPluginError(Errors.loaderFailure, this.resourcePath, (error as Error).message))
    return
  }

  const { ext, dimension, name } = parsed

  compileAsset(ext, source, dimension, name)
    .then((definition) => callback(null, `export default ${JSON.stringify(definition)}\n`))
    .catch((error) =>
      callback(new HeleonixWebpackPluginError(Errors.loaderFailure, this.resourcePath, (error as Error).message)),
    )
}
