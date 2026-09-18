import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { TypeResolver, createNodeTypeProgramHost } from "@heleonix/hx-analyzer"

describe("TypeResolver.discover", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-discover-"))

  beforeAll(() => {
    fs.writeFileSync(path.join(root, "tsconfig.json"), `{ "compilerOptions": { "strict": true, "noEmit": true } }`)
    // Minimal stand-ins for the hx-core bases (matched by name up the chain).
    fs.writeFileSync(
      path.join(root, "bases.ts"),
      `export abstract class Converter<TValue = unknown, TReturn = unknown, TParams = object> {
         abstract format(value: TValue, params: TParams): Promise<TReturn>
       }
       export abstract class Action<TParams = object> {
         abstract Execute(params: TParams): Promise<void>
       }`,
    )
    fs.writeFileSync(
      path.join(root, "TruncateConverter.ts"),
      `import { Converter } from "./bases"
       interface TruncateParams {
         /** Max length. */
         length: number
         ellipsis?: 'dots' | 'none'
       }
       export class TruncateConverter extends Converter<string, string, TruncateParams> {
         static readonly hxName = "Truncate"
         async format(value: string, params: TruncateParams) { return value.slice(0, params.length) }
       }`,
    )
    fs.writeFileSync(
      path.join(root, "SubmitAction.ts"),
      `import { Action } from "./bases"
       export class SubmitAction extends Action<{ id: number }> {
         static readonly hxName = "Submit"
         async Execute(params: { id: number }) { void params }
       }`,
    )
    fs.writeFileSync(
      path.join(root, "BadConverter.ts"),
      `import { Converter } from "./bases"
       // Declares no static hxName.
       export class Weird extends Converter<string, string, { n: number }> {
         async format(value: string) { return value }
       }`,
    )
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  describe("when the project is scanned", () => {
    it("then finds converter and action classes with declared names and resolved params", () => {
      const found = new Map(new TypeResolver(createNodeTypeProgramHost(root)).discover().map((c) => [c.className, c]))

      const truncate = found.get("TruncateConverter")!
      expect(truncate.base).toBe("Converter")
      expect(truncate.name).toBe("Truncate")
      expect(truncate.hasHxName).toBeTrue()
      const params = new Map(truncate.params.map((p) => [p.name, p]))
      expect(params.get("length")).toEqual(
        jasmine.objectContaining({ kind: "number", optional: false, docs: "Max length." }),
      )
      expect(params.get("ellipsis")).toEqual(
        jasmine.objectContaining({ kind: "enum", optional: true, enumValues: ["dots", "none"] }),
      )

      const submit = found.get("SubmitAction")!
      expect(submit.base).toBe("Action")
      expect(submit.name).toBe("Submit")
      expect(submit.params.map((p) => p.name)).toEqual(["id"])
    })

    it("then flags a class declaring no static hxName", () => {
      const found = new Map(new TypeResolver(createNodeTypeProgramHost(root)).discover().map((c) => [c.className, c]))

      expect(found.get("Weird")!.hasHxName).toBeFalse()
      expect(found.get("Weird")!.name).toBe("Weird")
    })
  })
})
