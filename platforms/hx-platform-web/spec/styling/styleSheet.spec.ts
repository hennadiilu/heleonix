import { RefcountedStyleSheet, DomStyleSheet } from "@heleonix/hx-platform-web"
import type { StyleSheetTarget } from "@heleonix/hx-platform-web"

class FakeTarget implements StyleSheetTarget {
  public readonly inserted: [string, string][] = []
  public readonly removed: string[] = []

  public insert(className: string, rule: string): void {
    this.inserted.push([className, rule])
  }

  public remove(className: string): void {
    this.removed.push(className)
  }
}

describe("RefcountedStyleSheet", () => {
  it("then inserts a rule once and removes it only when the last holder drops it", () => {
    const target = new FakeTarget()
    const sheet = new RefcountedStyleSheet(target)

    sheet.insert("hx-1", "rule")
    sheet.insert("hx-1", "rule")
    expect(target.inserted).toEqual([["hx-1", "rule"]])

    sheet.remove("hx-1")
    expect(target.removed).toEqual([])

    sheet.remove("hx-1")
    expect(target.removed).toEqual(["hx-1"])
  })
})

describe("DomStyleSheet", () => {
  it("then keeps the element text in sync with the inserted rules", () => {
    const element = { textContent: null as string | null }
    const sheet = new DomStyleSheet(element)

    sheet.insert("hx-1", ".hx-1 { color: red; }")
    sheet.insert("hx-2", ".hx-2 { color: blue; }")
    expect(element.textContent).toContain(".hx-1 {")
    expect(element.textContent).toContain(".hx-2 {")

    sheet.remove("hx-1")
    expect(element.textContent).not.toContain(".hx-1 {")
    expect(element.textContent).toContain(".hx-2 {")
  })
})
