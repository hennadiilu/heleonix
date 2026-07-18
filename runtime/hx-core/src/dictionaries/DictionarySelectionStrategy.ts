export enum DictionarySelectionStrategy {
  /** Use the first registered source that has definitions for the name. */
  First = "First",
  /** Use the last registered source that has definitions for the name. */
  Last = "Last",
  /** Collect definitions from every source into one dimension merge. */
  All = "All",
  /**
   * Resolve each source's definitions by dimension specificity, then fold the results
   * in registration order - later sources (the application) extend or override earlier
   * ones (libraries, framework) according to each definition's `usage`. The default.
   */
  Layered = "Layered",
}
