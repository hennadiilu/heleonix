import { pathToFileURL } from "node:url"
import { scanXml } from "@heleonix/hx-compiler-core"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import { definitionComponent } from "../src/languages/component/componentDefinition"

const components: IComponentInfo[] = [
  { name: "Card", open: false, members: [], file: "C:/proj/Card.ts", line: 3, character: 13 },
  // a native/hxm component carries no source location
  { name: "span", open: true, members: [] },
]

describe("definitionComponent", () => {
  describe("given the cursor on a programmatic component's tag name", () => {
    it("then returns its class location", () => {
      const source = `<Component><Card /></Component>`
      const result = definitionComponent(source.indexOf("Card") + 1, scanXml(source), components)

      expect(result?.uri).toBe(pathToFileURL("C:/proj/Card.ts").toString())
      expect(result?.range.start).toEqual({ line: 3, character: 13 })
    })
  })

  describe("given the cursor on a component without a source location", () => {
    it("then returns null (caller falls back to the occurrence index)", () => {
      const source = `<Component><span /></Component>`

      expect(definitionComponent(source.indexOf("span") + 1, scanXml(source), components)).toBeNull()
    })
  })

  describe("given the cursor not on any tag name", () => {
    it("then returns null", () => {
      const source = `<Component><Card /></Component>`
      const offset = source.indexOf("/>") // inside the tag, past the name

      expect(definitionComponent(offset, scanXml(source), components)).toBeNull()
    })
  })
})
