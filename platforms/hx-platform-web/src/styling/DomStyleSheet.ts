import type { StyleSheetTarget } from "./StyleSheetTarget"

export interface StyleSheetElement {
  textContent: string | null
}

export class DomStyleSheet implements StyleSheetTarget {
  private readonly rules = new Map<string, string>()

  private readonly element: StyleSheetElement

  public constructor(element: StyleSheetElement) {
    this.element = element
  }

  public insert(id: string, rule: string): void {
    this.rules.set(id, rule)
    this.flush()
  }

  public remove(id: string): void {
    this.rules.delete(id)
    this.flush()
  }

  private flush(): void {
    this.element.textContent = [...this.rules.values()].join("\n")
  }
}
