import { JsoncCompiler, ICompilerOptions } from "@heleonix/hx-compiler-core"
import type { IConfigDefinition } from "@heleonix/hx-language"
import type { IDimension, DimensionUsage, Kind } from "@heleonix/hx-language"
import { Errors } from "./errors/Errors"
import { HeleonixConfigCompilerError } from "./errors/HeleonixConfigCompilerError"

/**
 * Compiles `*.hxc` config source into a JSON-serializable definition.
 *
 * Source is a JSONC object with an optional YAML-style frontmatter header that
 * carries the merge `usage`:
 *
 * ```jsonc
 * ---
 * usage: extend
 * ---
 * {
 *   "Cfg1": 111,
 *   // comments are allowed
 *   "Array": [1, 2, 3]
 * }
 * ```
 *
 * Entry values may be any JSON type (string, number, boolean, null, array or
 * object) and are preserved as-is. Unlike dictionaries, config values carry no
 * interpolation markers or references.
 */
export class ConfigCompiler extends JsoncCompiler<IConfigDefinition> {
  protected get kind(): Kind {
    return "config"
  }

  protected compileDocument(
    frontmatter: Record<string, string>,
    root: unknown,
    dimension: IDimension,
    options: ICompilerOptions,
  ): IConfigDefinition {
    if (!isPlainObject(root)) {
      throw new HeleonixConfigCompilerError(Errors.invalidRoot)
    }

    return {
      name: options.name ?? "",
      dimension,
      usage: normalizeUsage(frontmatter["usage"]),
      entries: { ...root },
    }
  }
}

function normalizeUsage(raw: string | undefined): DimensionUsage | undefined {
  if (raw === "extend") {
    return "extend"
  } else if (raw === "override") {
    return "override"
  }

  return undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
