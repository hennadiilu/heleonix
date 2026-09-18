import type { IHeaderBlock } from "./IHeaderBlock"

export interface IFrontmatterDocument {
  frontmatter: Record<string, string>

  frontmatterDocs?: Record<string, string>

  body: string

  docs?: string

  blocks?: Record<string, IHeaderBlock>

  types?: Record<string, string>
}
