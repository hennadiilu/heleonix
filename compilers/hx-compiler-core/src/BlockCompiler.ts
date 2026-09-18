import { parseDocComment, type IDimension, type IDocsEntry, type Kind } from "@heleonix/hx-language"
import { ICompilerOptions } from "./ICompilerOptions"
import { parseBlocks } from "./block/parseBlocks"
import type { IBlockDocument } from "./block/IBlockDocument"
import { splitFrontmatter } from "./jsonc/Frontmatter"
import type { IFrontmatterDocument } from "./jsonc/IFrontmatterDocument"
import { Errors } from "./errors/Errors"
import { HeleonixCompilerError } from "./errors/HeleonixCompilerError"

export abstract class BlockCompiler<TResult> {
  protected abstract get kind(): Kind

  public async compile(source: string, dimension: IDimension, options?: ICompilerOptions): Promise<TResult> {
    if (!source || !source.trim()) {
      throw new HeleonixCompilerError(Errors.emptySource)
    }

    const header = splitFrontmatter(source)

    if (!header.body.trim()) {
      throw new HeleonixCompilerError(Errors.emptySource)
    }

    return this.compileDocument(parseBlocks(header.body), header, dimension, options ?? {})
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

    const raw = parseBlocks(body).nodes[0]?.doc

    if (!raw) {
      return undefined
    }

    const docs = parseDocComment(raw.slice(2, -2))

    if (!docs || Object.keys(docs).length === 0) {
      return undefined
    }

    return { kind: this.kind, name: options?.name ?? "", dimension, docs }
  }

  protected abstract compileDocument(
    document: IBlockDocument,
    header: IFrontmatterDocument,
    dimension: IDimension,
    options: ICompilerOptions,
  ): TResult | Promise<TResult>
}
