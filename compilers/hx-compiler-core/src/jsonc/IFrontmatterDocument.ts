/**
 * Result of splitting a source file into its optional frontmatter header and
 * the remaining body.
 */
export interface IFrontmatterDocument {
  /**
   * Flat `key: value` pairs parsed from the leading `--- ... ---` block.
   * Empty when the source has no frontmatter.
   */
  frontmatter: Record<string, string>

  /**
   * Source remaining after the frontmatter block (the document body).
   */
  body: string
}
