import { pathToFileURL } from "node:url"
import { scanXml } from "@heleonix/hx-compiler-core"
import type { IRegistryInfo } from "@heleonix/hx-analyzer"
import { TextDocument } from "vscode-languageserver-textdocument"
import {
  completeConverterAction,
  definitionConverterAction,
  hoverConverterAction,
} from "../src/languages/component/converterActionFeature.ts"

const converters: IRegistryInfo[] = [
  {
    name: "Truncate",
    params: [
      { name: "length", optional: false, kind: "number", isFunction: false },
      { name: "ellipsis", optional: true, kind: "enum", enumValues: ["dots", "none"], isFunction: false },
    ],
    docs: "Shortens a string.",
    file: "C:/proj/TruncateConverter.ts",
    line: 4,
    character: 13,
  },
]

const actions: IRegistryInfo[] = [
  {
    name: "Submit",
    params: [{ name: "id", optional: false, kind: "number", isFunction: false }],
    file: "C:/proj/SubmitAction.ts",
    line: 2,
    character: 13,
  },
]

function at(source: string, marker: string): { doc: TextDocument; offset: number } {
  const doc = TextDocument.create("file:///Form.hxm", "heleonix-component", 1, source)

  return { doc, offset: source.indexOf(marker) + marker.length }
}

describe("converterActionFeature", () => {
  describe("given a converter pipe in an attribute value", () => {
    const source = `<Component><span title="@X.y | Tr" /></Component>`

    describe("when completion is requested on the converter name", () => {
      it("then offers the discovered converter names", () => {
        const { doc, offset } = at(source, "| Tr")
        const items = completeConverterAction(doc, offset, scanXml(source), converters, actions)

        expect(items?.map((item) => item.label)).toEqual(["Truncate"])
      })
    })
  })

  describe("given a converter pipe in text content", () => {
    const source = `<Component><span>data | Truncate</span></Component>`

    describe("when hover is requested on the converter name", () => {
      it("then shows the signature and docs", () => {
        const { doc, offset } = at(source, "Trunc")
        const hover = hoverConverterAction(doc, offset, scanXml(source), converters, actions)

        expect(hover).not.toBeNull()
        expect(JSON.stringify(hover)).toContain("Truncate(length: number, ellipsis?: 'dots' | 'none')")
        expect(JSON.stringify(hover)).toContain("Shortens a string.")
      })
    })

    describe("when go-to-definition is requested on the converter name", () => {
      it("then resolves to the class location", () => {
        const { doc, offset } = at(source, "Trunc")
        const location = definitionConverterAction(doc, offset, scanXml(source), converters, actions)

        expect(location?.uri).toBe(pathToFileURL("C:/proj/TruncateConverter.ts").toString())
        expect(location?.range.start).toEqual({ line: 4, character: 13 })
      })
    })
  })

  describe("given converter arguments", () => {
    const source = `<Component><span>data | Truncate(le)</span></Component>`

    describe("when completion is requested inside the argument list", () => {
      it("then offers the converter's parameter names", () => {
        const { doc, offset } = at(source, "(le")
        const items = completeConverterAction(doc, offset, scanXml(source), converters, actions)

        expect(items?.map((item) => item.label).sort()).toEqual(["ellipsis", "length"])
      })
    })
  })

  describe("given an Execute action attribute", () => {
    const source = `<Component><Execute action="Su" /></Component>`

    describe("when completion is requested on the action name", () => {
      it("then offers the discovered action names", () => {
        const { doc, offset } = at(source, `action="Su`)
        const items = completeConverterAction(doc, offset, scanXml(source), converters, actions)

        expect(items?.map((item) => item.label)).toEqual(["Submit"])
      })
    })

    describe("when go-to-definition is requested on the action name", () => {
      it("then resolves to the action class location", () => {
        const full = `<Component><Execute action="Submit" /></Component>`
        const { doc, offset } = at(full, `action="Sub`)
        const location = definitionConverterAction(doc, offset, scanXml(full), converters, actions)

        expect(location?.uri).toBe(pathToFileURL("C:/proj/SubmitAction.ts").toString())
      })
    })
  })

  describe("given a binding source that is not a converter", () => {
    const source = `<Component><span title="@X.y" /></Component>`

    describe("when completion is requested in the source segment", () => {
      it("then defers (returns undefined) so ordinary completion runs", () => {
        const { doc, offset } = at(source, "@X.")
        const items = completeConverterAction(doc, offset, scanXml(source), converters, actions)

        expect(items).toBeUndefined()
      })
    })
  })
})
