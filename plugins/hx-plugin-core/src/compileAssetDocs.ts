import { ComponentCompiler } from "@heleonix/hx-compiler-components"
import { DictionaryCompiler } from "@heleonix/hx-compiler-dictionaries"
import { ConfigCompiler } from "@heleonix/hx-compiler-configs"
import { StyleCompiler } from "@heleonix/hx-compiler-styles"
import { ThemeCompiler } from "@heleonix/hx-compiler-themes"
import type { IDimension, IDocsEntry } from "@heleonix/hx-language"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_STYLE, EXT_TEMPLATE, EXT_THEME } from "@heleonix/hx-language"
import { HeleonixPluginError } from "./errors/HeleonixPluginError"
import { Errors } from "./errors/Errors"

interface IAssetDocsCompiler {
  compileDocs(source: string, dimension: IDimension, options: { name: string }): IDocsEntry | undefined
}

const COMPILERS: Readonly<Record<string, () => IAssetDocsCompiler>> = {
  [EXT_TEMPLATE]: () => new ComponentCompiler(),
  [EXT_DICTIONARY]: () => new DictionaryCompiler(),
  [EXT_CONFIG]: () => new ConfigCompiler(),
  [EXT_STYLE]: () => new StyleCompiler(),
  [EXT_THEME]: () => new ThemeCompiler(),
}

/**
 * Compiles one asset's docs sidecar (the `compileDocs` counterpart of
 * {@link compileAsset}): doc comments extracted into an {@link IDocsEntry}, or
 * `undefined` when the source carries none. Docs are emitted as separate
 * `*.docs.json` artifacts so runtime definition payloads never carry them.
 */
export function compileAssetDocs(
  ext: string,
  source: string,
  dimension: IDimension,
  name: string,
): IDocsEntry | undefined {
  const create = COMPILERS[ext]

  if (!create) {
    throw new HeleonixPluginError(Errors.unsupportedExtension, ext)
  }

  return create().compileDocs(source, dimension, { name })
}
