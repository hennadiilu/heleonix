import { DomStyleSheet } from "@heleonix/hx-platform-web"

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
