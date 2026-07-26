import type { StyleSheetTarget } from "./StyleSheetTarget"

/** The minimal `<style>`-element surface {@link DomStyleSheet} writes to. */
export interface StyleSheetElement {
  textContent: string | null
}

/**
 * Writes composed rules into a `<style>` element's text, keyed by class name so
 * each can be removed. Rebuilds the text on every change (simple and correct;
 * insertion is deduped upstream by {@link RefcountedStyleSheet}, so writes are
 * infrequent). Testable against any `{ textContent }` object - no live DOM.
 */
export class DomStyleSheet implements StyleSheetTarget {
  private readonly rules = new Map<string, string>()

  private readonly element: StyleSheetElement

  public constructor(element: StyleSheetElement) {
    this.element = element
  }

  public insert(className: string, rule: string): void {
    this.rules.set(className, rule)
    this.flush()
  }

  public remove(className: string): void {
    this.rules.delete(className)
    this.flush()
  }

  private flush(): void {
    this.element.textContent = [...this.rules.values()].join("\n")
  }
}
