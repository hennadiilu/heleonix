import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Analyzer, TypeResolver, createNodeTypeProgramHost } from "@heleonix/hx-analyzer"

describe("TypeResolver.discover (style qualifiers)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-qualifiers-"))

  beforeAll(() => {
    fs.writeFileSync(path.join(root, "tsconfig.json"), `{ "compilerOptions": { "strict": true, "noEmit": true } }`)
    fs.writeFileSync(
      path.join(root, "bases.ts"),
      `export abstract class StyleQualifier<TArgs = object> {\n  protected declare args: TArgs\n}`,
    )
    fs.writeFileSync(
      path.join(root, "refs.ts"),
      `export type PropertyRef = string & { readonly __ref: 'property' }
       export type EventRef = string & { readonly __ref: 'event' }
       export type ThemeTokenRef = string & { readonly __ref: 'theme' }`,
    )
    fs.writeFileSync(
      path.join(root, "IfQualifier.ts"),
      `import { StyleQualifier } from "./bases"
       import type { PropertyRef } from "./refs"
       interface IfArgs {
         /** The condition subject. */
         value: PropertyRef
         is?: 'primary' | 'danger'
       }
       export class IfQualifier extends StyleQualifier<IfArgs> {}`,
    )
    fs.writeFileSync(
      path.join(root, "OnRaisingQualifier.ts"),
      `import { StyleQualifier } from "./bases"
       import type { EventRef, ThemeTokenRef } from "./refs"
       interface OnRaisingArgs { event: EventRef; token?: ThemeTokenRef }
       export class OnRaisingQualifier extends StyleQualifier<OnRaisingArgs> {}`,
    )
    fs.writeFileSync(
      path.join(root, "Weird.ts"),
      `import { StyleQualifier } from "./bases"
       // Missing the required 'Qualifier' suffix.
       export class Weird extends StyleQualifier<{ n: number }> {}`,
    )
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  describe("when the project is scanned", () => {
    it("then derives names, resolves TArgs members and branded ref kinds", () => {
      const resolver = new TypeResolver(createNodeTypeProgramHost(root))
      resolver.discover()

      const found = new Map(resolver.qualifiers().map((q) => [q.className, q]))

      const iff = found.get("IfQualifier")!
      expect(iff.name).toBe("If")
      expect(iff.suffixOk).toBeTrue()

      const ifArgs = new Map(iff.args.map((a) => [a.name, a]))
      expect(ifArgs.get("value")).toEqual(
        jasmine.objectContaining({ refKind: "property", optional: false, docs: "The condition subject." }),
      )
      expect(ifArgs.get("is")).toEqual(
        jasmine.objectContaining({ kind: "enum", optional: true, enumValues: ["primary", "danger"] }),
      )

      const onRaising = found.get("OnRaisingQualifier")!
      expect(onRaising.name).toBe("OnRaising")

      const onArgs = new Map(onRaising.args.map((a) => [a.name, a]))
      expect(onArgs.get("event")!.refKind).toBe("event")
      expect(onArgs.get("token")!.refKind).toBe("theme")
    })

    it("then flags a qualifier missing its 'Qualifier' suffix and skips the abstract base", () => {
      const resolver = new TypeResolver(createNodeTypeProgramHost(root))
      resolver.discover()

      const found = new Map(resolver.qualifiers().map((q) => [q.className, q]))

      expect(found.get("Weird")!.suffixOk).toBeFalse()
      expect(found.has("StyleQualifier")).toBeFalse()
    })
  })
})

describe("Analyzer.qualifiers (meta delivery)", () => {
  it("then exposes qualifier contracts delivered by a dependency's meta", async () => {
    const analyzer = new Analyzer()
    analyzer.addMeta({
      schemaVersion: 1,
      qualifiers: [
        {
          name: "If",
          args: [
            { name: "value", optional: false, kind: "boolean", isFunction: false, refKind: "property" },
            { name: "is", optional: true, kind: "enum", isFunction: false, enumValues: ["primary"] },
          ],
        },
      ],
    })

    await analyzer.analyze()

    const qualifiers = analyzer.qualifiers()
    expect(qualifiers.map((q) => q.name)).toEqual(["If"])
    expect(qualifiers[0].args[0].refKind).toBe("property")
  })
})
