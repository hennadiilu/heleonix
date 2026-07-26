/**
 * A place composed CSS rules are written, keyed by their content-hashed class
 * name so a rule can be removed later. Kept abstract so the refcounting decorator
 * and the engine platform stay testable without the DOM.
 */
export interface StyleSheetTarget {
  insert(className: string, rule: string): void

  remove(className: string): void
}
