import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { TypeResolver, createNodeTypeProgramHost } from "@heleonix/hx-analyzer"

describe("TypeResolver", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-typeresolver-"))

  beforeAll(() => {
    fs.writeFileSync(path.join(root, "tsconfig.json"), `{ "compilerOptions": { "strict": true, "noEmit": true } }`)
    fs.writeFileSync(path.join(root, "shared.ts"), `export interface RowData { id: number; label: string }`)
    fs.writeFileSync(path.join(root, "globals.d.ts"), `declare type GlobalVariant = "g1" | "g2"`)
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  describe("given inline, global and import-reference type text", () => {
    let resolved: ReturnType<TypeResolver["resolve"]>

    beforeAll(() => {
      resolved = new TypeResolver(createNodeTypeProgramHost(root)).resolve([
        {
          id: "Inline",
          dir: root,
          typeText: `{
            /** Visual emphasis. */
            variant?: "primary" | "default"
            count: number
            flag?: boolean
            onClick?: () => void
            rows?: import("./shared").RowData[]
          }`,
        },
        { id: "Global", dir: root, typeText: `{ v: GlobalVariant }` },
        { id: "Imported", dir: root, typeText: `import("./shared").RowData` },
        { id: "Missing", dir: root, typeText: `NoSuchType` },
      ])
    })

    describe("when the inline type is resolved", () => {
      it("then classifies each member with kind, optionality, enum values and function flag", () => {
        const members = new Map(resolved.get("Inline")!.members.map((member) => [member.name, member]))

        expect(resolved.get("Inline")!.resolved).toBeTrue()
        expect(members.get("variant")).toEqual(
          jasmine.objectContaining({
            kind: "enum",
            optional: true,
            enumValues: ["primary", "default"],
            docs: "Visual emphasis.",
          }),
        )
        expect(members.get("count")).toEqual(jasmine.objectContaining({ kind: "number", optional: false }))
        expect(members.get("flag")).toEqual(jasmine.objectContaining({ kind: "boolean", optional: true }))
        expect(members.get("onClick")!.isFunction).toBeTrue()
        expect(members.get("rows")).toEqual(jasmine.objectContaining({ kind: "array", optional: true }))
      })
    })

    describe("when a global ambient type is referenced", () => {
      it("then resolves its enum members", () => {
        const member = resolved.get("Global")!.members[0]

        expect(member).toEqual(jasmine.objectContaining({ name: "v", kind: "enum", enumValues: ["g1", "g2"] }))
      })
    })

    describe("when an imported type is referenced directly", () => {
      it("then resolves the imported interface's members", () => {
        const members = resolved
          .get("Imported")!
          .members.map((member) => member.name)
          .sort()

        expect(members).toEqual(["id", "label"])
      })
    })

    describe("when an unknown type name is referenced", () => {
      it("then reports it as unresolved", () => {
        expect(resolved.get("Missing")).toEqual({ resolved: false, members: [] })
      })
    })
  })
})
