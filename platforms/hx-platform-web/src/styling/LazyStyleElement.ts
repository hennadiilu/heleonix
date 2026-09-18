import type { StyleSheetElement } from "./DomStyleSheet"

export class LazyStyleElement implements StyleSheetElement {
  private element: StyleSheetElement | undefined

  private pending: string | null = null

  private readonly materialize: () => StyleSheetElement

  public constructor(materialize: () => StyleSheetElement) {
    this.materialize = materialize
  }

  public get textContent(): string | null {
    return this.element ? this.element.textContent : this.pending
  }

  public set textContent(value: string | null) {
    if (!this.element && !value) {
      this.pending = value

      return
    }

    this.element ??= this.materialize()

    this.element.textContent = value
  }
}
