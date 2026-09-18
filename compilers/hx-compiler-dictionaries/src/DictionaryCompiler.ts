import { JsoncCompiler, ICompilerOptions, parseJsonc } from "@heleonix/hx-compiler-core"
import type { IDictionaryDefinition } from "@heleonix/hx-language"
import type { IDimension, DimensionUsage, Kind } from "@heleonix/hx-language"
import { Errors } from "./errors/Errors"
import { HeleonixDictionaryCompilerError } from "./errors/HeleonixDictionaryCompilerError"

export class DictionaryCompiler extends JsoncCompiler<IDictionaryDefinition> {
  protected get kind(): Kind {
    return "dictionary"
  }

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
