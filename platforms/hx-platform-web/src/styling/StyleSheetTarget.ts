export interface StyleSheetTarget {
  insert(className: string, rule: string): void

  remove(className: string): void
}
