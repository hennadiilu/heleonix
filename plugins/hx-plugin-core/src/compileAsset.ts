import { ComponentCompiler } from "@heleonix/hx-compiler-components"
import { DictionaryCompiler } from "@heleonix/hx-compiler-dictionaries"
import { ConfigCompiler } from "@heleonix/hx-compiler-configs"
import { StyleCompiler } from "@heleonix/hx-compiler-styles"
import { ThemeCompiler } from "@heleonix/hx-compiler-themes"
import type { IComponentDefinition } from "@heleonix/hx-language"
import type { IConfigDefinition } from "@heleonix/hx-language"
import type { IDictionaryDefinition } from "@heleonix/hx-language"
import type { IDimension } from "@heleonix/hx-language"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_STYLE, EXT_TEMPLATE, EXT_THEME } from "@heleonix/hx-language"
import type { IStyleDefinition } from "@heleonix/hx-language"
import type { IThemeDefinition } from "@heleonix/hx-language"
import { HeleonixPluginError } from "./errors/HeleonixPluginError"
import { Errors } from "./errors/Errors"

type AssetDefinition =
  | IComponentDefinition
  | IDictionaryDefinition
  | IConfigDefinition
  | IStyleDefinition
  | IThemeDefinition

interface IAssetCompiler {
  compile(source: string, dimension: IDimension, options: { name: string }): Promise<AssetDefinition>
}

const COMPILERS: Readonly<Record<string, () => IAssetCompiler>> = {
  [EXT_TEMPLATE]: () => new ComponentCompiler(),
  [EXT_DICTIONARY]: () => new DictionaryCompiler(),
  [EXT_CONFIG]: () => new ConfigCompiler(),
  [EXT_STYLE]: () => new StyleCompiler(),
  [EXT_THEME]: () => new ThemeCompiler(),
}

export async function compileAsset(
  ext: string,
  source: string,
  dimension: IDimension,
  name: string,
): Promise<AssetDefinition> {
  const create = COMPILERS[ext]

  if (!create) {
    throw new HeleonixPluginError(Errors.unsupportedExtension, ext)
  }

  return create().compile(source, dimension, { name })
}
