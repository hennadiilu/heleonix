import type { IDimension, IDocs, IDocsEntry, Kind } from "@heleonix/hx-language"
import { ICompilerOptions } from "./ICompilerOptions"
import { XmlParser } from "./xml/XmlParser"
import { IXmlElement } from "./xml/IXmlElement"
import { IXmlScan } from "./xml/IXmlScan"
import { scanXml } from "./xml/scanXml"
import { splitFrontmatter } from "./jsonc/Frontmatter"
import type { IFrontmatterDocument } from "./jsonc/IFrontmatterDocument"
import { xmlRootDocs } from "./docs/xmlRootDocs"
import { Errors } from "./errors/Errors"
import { HeleonixCompilerError } from "./errors/HeleonixCompilerError"

export abstract class XmlCompiler<TResult> {
  protected readonly parser: XmlParser = new XmlParser()

  protected abstract get rootTag(): string

  protected abstract get kind(): Kind

  public async compile(source: string, dimension: IDimension, options?: ICompilerOptions): Promise<TResult> {
    if (!source || !source.trim()) {
      throw new HeleonixCompilerError(Errors.emptySource)
    }

    const header = splitFrontmatter(source)

    if (!header.body.trim()) {
      throw new HeleonixCompilerError(Errors.emptySource)
    }

    const root = this.parser.parse(header.body)
    const expected = this.rootTag

    if (root.tag !== expected) {
      throw new HeleonixCompilerError(Errors.invalidRootElement, expected, root.tag)
    }

    return this.compileElement(root, dimension, options ?? {}, header)
  }

  /**
   * Compiles the docs sidecar of the same source: doc comments
   * (`<!--* ... -->`) associated with the nodes they precede. Tolerant by
   * design - docs are optional, so unparsable or undocumented source yields
   * `undefined` rather than an error (`compile` reports the real problems).
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

    const docs = this.extractDocs(scanXml(body), body)

    return docs ? { kind: this.kind, name: options?.name ?? "", dimension, docs } : undefined
  }

  /** Docs of the file-level doc comment above the root element; per-entry formats override to add `entries`. */
  protected extractDocs(scan: IXmlScan, source: string): IDocs | undefined {
    return xmlRootDocs(scan, source, this.rootTag)
  }

  protected abstract compileElement(
    root: IXmlElement,
    dimension: IDimension,
    options: ICompilerOptions,
    header: IFrontmatterDocument,
  ): TResult | Promise<TResult>
}
