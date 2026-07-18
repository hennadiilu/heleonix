import type { IDimension, IDocs, IDocsEntry, Kind } from "@heleonix/hx-language"
import { ICompilerOptions } from "./ICompilerOptions"
import { JsoncParser } from "./jsonc/JsoncParser"
import { parseJsonc } from "./jsonc/parseJsonc"
import { splitFrontmatter } from "./jsonc/Frontmatter"
import { docCommentBefore } from "./docs/docCommentBefore"
import { jsoncEntryDocs } from "./docs/jsoncEntryDocs"
import { Errors } from "./errors/Errors"
import { HeleonixCompilerError } from "./errors/HeleonixCompilerError"

export abstract class JsoncCompiler<TResult> {
  protected readonly parser: JsoncParser = new JsoncParser()

  protected abstract get kind(): Kind

  public async compile(source: string, dimension: IDimension, options?: ICompilerOptions): Promise<TResult> {
    if (!source || !source.trim()) {
      throw new HeleonixCompilerError(Errors.emptySource)
    }

    const { frontmatter, body } = splitFrontmatter(source)

    if (!body.trim()) {
      throw new HeleonixCompilerError(Errors.emptySource)
    }

    const root = this.parseBody(body)

    return this.compileDocument(frontmatter, root, dimension, options ?? {})
  }

  /**
   * Compiles the docs sidecar of the same source: a `/** ... *\/` doc comment
   * above the root object plus inline doc comments above top-level entries.
   * Tolerant by design - docs are optional, so unparsable or undocumented
   * source yields `undefined` rather than an error (`compile` reports the real
   * problems).
   */
  public compileDocs(source: string, dimension: IDimension, options?: ICompilerOptions): IDocsEntry | undefined {
    if (!source || !source.trim()) {
      return undefined
    }

    let body: string

    try {
      body = splitFrontmatter(source).body
    } catch {
      return undefined
    }

    let parsed

    try {
      parsed = parseJsonc(body)
    } catch {
      return undefined
    }

    const docs: IDocs = { ...docCommentBefore(parsed.comments, parsed.rootStart, body) }
    const entries = jsoncEntryDocs(parsed.entries, parsed.comments, body)

    if (entries) {
      docs.entries = entries
    }

    if (Object.keys(docs).length === 0) {
      return undefined
    }

    return { kind: this.kind, name: options?.name ?? "", dimension, docs }
  }

  /**
   * Parses the JSONC body into a value. Defaults to permissive parsing (nesting
   * allowed, as in `*.hxc`); subclasses may override to enforce a stricter
   * shape, e.g. the flat string object required by `*.hxd`.
   */
  protected parseBody(body: string): unknown {
    return this.parser.parse(body)
  }

  protected abstract compileDocument(
    frontmatter: Record<string, string>,
    root: unknown,
    dimension: IDimension,
    options: ICompilerOptions,
  ): TResult | Promise<TResult>
}
