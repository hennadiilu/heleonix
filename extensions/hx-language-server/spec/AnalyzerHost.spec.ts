import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { AnalyzerHost } from "../src/analysis/AnalyzerHost"

describe("AnalyzerHost", () => {
  describe("given a workspace with a dictionary and a component with a bad reference", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-analyzer-host-"))
    const formSource = `<Component><span>{@Buttons.missing}</span></Component>`
    const formPath = path.join(root, "Form.hxm")

    beforeAll(() => {
      fs.writeFileSync(path.join(root, "Buttons.hxd"), `{ "save": "Save" }`)
      fs.writeFileSync(formPath, formSource)
    })

    afterAll(() => {
      fs.rmSync(root, { recursive: true, force: true })
    })

    describe("when the workspace is seeded and the broken document is diagnosed", () => {
      it("then reports the build's diagnostic code at the subject's range", async () => {
        const host = new AnalyzerHost()

        host.addMeta({ schemaVersion: 1, components: [{ name: "span", dimension: {}, open: true }] })
        host.seed([root], new Set())

        const document = TextDocument.create(pathToFileURL(formPath).toString(), "heleonix-component", 1, formSource)
        const result = await host.diagnosticsFor(formPath, document)

        expect(result.length).toBe(1)
        expect(result[0].code).toBe("HX_ANALYZER_0002")

        const start = document.offsetAt(result[0].range.start)
        const end = document.offsetAt(result[0].range.end)

        expect(formSource.slice(start, end)).toBe("@Buttons.missing")
      })
    })

    describe("when the reference is fixed through an update", () => {
      it("then the diagnostic disappears", async () => {
        const host = new AnalyzerHost()

        host.addMeta({ schemaVersion: 1, components: [{ name: "span", dimension: {}, open: true }] })
        host.seed([root], new Set())
        host.update(formPath, formSource.replace("@Buttons.missing", "@Buttons.save"))

        const document = TextDocument.create(pathToFileURL(formPath).toString(), "heleonix-component", 1, formSource)

        expect(await host.diagnosticsFor(formPath, document)).toEqual([])
      })
    })
  })

  describe("given a TypeScript-typed component and a workspace with a tsconfig", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-analyzer-host-ts-"))
    const formSource = `<Component><Greeting variant="flashy" /></Component>`
    const formPath = path.join(root, "Form.hxm")

    beforeAll(() => {
      fs.writeFileSync(path.join(root, "tsconfig.json"), `{ "compilerOptions": { "strict": true, "noEmit": true } }`)
      fs.writeFileSync(
        path.join(root, "Greeting.hxm"),
        `---\nprops: { variant?: 'primary' | 'secondary' }\n---\n<Component><span /></Component>`,
      )
      fs.writeFileSync(formPath, formSource)
    })

    afterAll(() => {
      fs.rmSync(root, { recursive: true, force: true })
    })

    describe("when a document binds an out-of-enum value to a typed prop", () => {
      it("then the editor reports the same TS-backed error at the value's range", async () => {
        const host = new AnalyzerHost()

        host.addMeta({ schemaVersion: 1, components: [{ name: "span", dimension: {}, open: true }] })
        host.seed([root], new Set())

        const document = TextDocument.create(pathToFileURL(formPath).toString(), "heleonix-component", 1, formSource)
        const result = await host.diagnosticsFor(formPath, document)

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0102"])
        expect(result[0].severity).toBe(DiagnosticSeverity.Error)

        const start = document.offsetAt(result[0].range.start)
        const end = document.offsetAt(result[0].range.end)

        expect(formSource.slice(start, end)).toBe("flashy")
      })
    })
  })
})
