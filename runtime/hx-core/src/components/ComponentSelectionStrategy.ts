export enum ComponentSelectionStrategy {
  /** Use the first registered source that has definitions for the name. */
  First = "First",
  /** Use the last registered source that has definitions for the name. */
  Last = "Last",
  /** Collect definitions from every source into one dimension selection. */
  All = "All",
  /**
   * Walk sources from the last registered (the application) to the first (libraries,
   * framework) and use the first source whose definitions match the current dimension -
   * so a downstream package's component replaces an upstream one entirely, while
   * dimensions still select within the winning package. The default.
   */
  Layered = "Layered",
}
