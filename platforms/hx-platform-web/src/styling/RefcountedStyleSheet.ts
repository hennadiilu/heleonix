import type { StyleSheetTarget } from "./StyleSheetTarget"

export class RefcountedStyleSheet implements StyleSheetTarget {
  private readonly counts = new Map<string, number>()

  private readonly target: StyleSheetTarget

  public constructor(target: StyleSheetTarget) {
    this.target = target
  }

  public insert(className: string, rule: string): void {
    const count = this.counts.get(className) ?? 0

    if (count === 0) {
      this.target.insert(className, rule)
    }

    this.counts.set(className, count + 1)
  }

  public remove(className: string): void {
    const count = this.counts.get(className) ?? 0

    if (count <= 1) {
      this.counts.delete(className)
      this.target.remove(className)
    } else {
      this.counts.set(className, count - 1)
    }
  }
}
