import { parseDocComment, type IDimension, type IDocsEntry, type Kind } from "@heleonix/hx-language"
import { ICompilerOptions } from "./ICompilerOptions"
import { parseBlocks } from "./block/parseBlocks"
import type { IBlockDocument } from "./block/IBlockDocument"
import { splitFrontmatter } from "./jsonc/Frontmatter"
import type { IFrontmatterDocument } from "./jsonc/IFrontmatterDocument"
import { Errors } from "./errors/Errors"
import { HeleonixCompilerError } from "./errors/HeleonixCompilerError"

/**
 * Base for the CSS-subset formats (`*.hxs`, `*.hxt`): splits the frontmatter
 * header, parses the body with the shared block grammar ({@link parseBlocks})
 * and hands the generic AST to the subclass. Mirrors {@link JsoncCompiler} but
 * over blocks instead of JSONC.
 */
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

  /**
   * Compiles the docs sidecar: the file-level `/** ... *\/` comment above the
   * first node. Tolerant by design - docs are optional, so unparsable or
   * undocumented source yields `undefined`. Per-entry (token) docs are assembled
   * by subclasses that override this.
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
