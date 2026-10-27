export interface StyleSheetTarget {
  insert(id: string, rule: string): void

  remove(id: string): void
}
