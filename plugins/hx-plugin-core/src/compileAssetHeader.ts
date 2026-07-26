import { ComponentCompiler } from "@heleonix/hx-compiler-components"
import { EXT_TEMPLATE } from "@heleonix/hx-language"
import type { IComponentHeader } from "@heleonix/hx-language"

/**
 * Compiles the typings-frontmatter facts of one asset. Only `*.hxm` sources
 * carry component headers; other extensions yield `undefined`.
 */
export function compileAssetHeader(ext: string, source: string): IComponentHeader | undefined {
  if (ext !== EXT_TEMPLATE) {
    return undefined
  }

  return new ComponentCompiler().compileHeader(source)
}
