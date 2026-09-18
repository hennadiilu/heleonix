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
