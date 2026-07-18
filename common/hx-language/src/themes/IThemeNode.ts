export interface IThemeNode {
  /** Attributes on this node (typically `value`). */
  attributes: Record<string, string>

  /** Nested groups / leaves keyed by their tag name. */
  children?: Record<string, IThemeNode>
}
