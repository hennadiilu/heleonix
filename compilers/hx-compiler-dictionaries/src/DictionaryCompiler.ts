import { JsoncCompiler, ICompilerOptions, parseJsonc } from "@heleonix/hx-compiler-core"
import type { IDictionaryDefinition } from "@heleonix/hx-language"
import type { IDimension, DimensionUsage, Kind } from "@heleonix/hx-language"
import { Errors } from "./errors/Errors"
import { HeleonixDictionaryCompilerError } from "./errors/HeleonixDictionaryCompilerError"

/**
 * Compiles `*.hxd` dictionary source into a JSON-serializable definition.
 *
 * Source is a JSONC object with an optional YAML-style frontmatter header that
 * carries the merge `usage`:
 *
 * ```jsonc
 * ---
 * usage: override
 * ---
 * {
 *   "Add": "Add",
 *   // comments are allowed
 *   "Ok": "OK {usertitle}",
 *   "OkOrCancel": "Hi {username}! Are you {@Ok} or {@BaseControls.Cancel}?"
 * }
 * ```
 *
 * Every entry value must be a string. Interpolation markers like `{prop}`,
 * `{@Other.Key}` are preserved as-is - they are interpreted by the runtime
 * dictionary provider.
 */
export class DictionaryCompiler extends JsoncCompiler<IDictionaryDefinition> {
  protected get kind(): Kind {
    return "dictionary"
  }

  /**
   * Parses the body and enforces the dictionary shape via the shared parser: a
   * flat object of string values. Flatness violations collected by `parseJsonc`
   * are surfaced as compiler errors (the first one is thrown).
   */
  protected override parseBody(body: string): unknown {
    const { value, issues } = parseJsonc(body)
    const issue = issues[0]

    if (issue) {
      if (issue.kind === "notObject") {
        throw new HeleonixDictionaryCompilerError(Errors.invalidRoot)
      }

      throw new HeleonixDictionaryCompilerError(Errors.invalidEntry, issue.key ?? "")
    }

    return value
  }

  protected compileDocument(
    frontmatter: Record<string, string>,
    root: unknown,
    dimension: IDimension,
    options: ICompilerOptions,
  ): IDictionaryDefinition {
    return {
      name: options.name ?? "",
      dimension,
      usage: normalizeUsage(frontmatter["usage"]),
      // `parseBody` has validated `root` is a flat object of string values.
      entries: { ...(root as Record<string, string>) },
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
