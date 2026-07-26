import { buildMeta } from "@heleonix/hx-plugin-core"

describe("buildMeta", () => {
  describe("given docs and component headers", () => {
    const input = {
      docs: [
        { kind: "dictionary" as const, name: "Sandbox", dimension: {}, docs: { summary: "App texts." } },
        { kind: "component" as const, name: "Greeting", dimension: {}, docs: { summary: "Greets." } },
      ],
      components: [
        {
          name: "Greeting",
          dimension: {},
          props: [
            {
              name: "variant",
              optional: true,
              kind: "enum" as const,
              enumValues: ["primary", "default"],
              isFunction: false,
            },
          ],
        },
        {
          name: "Button",
          dimension: {},
          props: [{ name: "title", optional: false, kind: "string" as const, isFunction: false }],
        },
      ],
    }

    describe("when the meta manifest is built", () => {
      it("then returns one sorted document with the resolved member facts preserved", () => {
        const result = buildMeta(input, { package: "@acme/ui", version: "1.0.0" })

        expect(result.schemaVersion).toBe(1)
        expect(result.package).toBe("@acme/ui")
        expect(result.docs!.map((entry) => entry.kind)).toEqual(["component", "dictionary"])
        expect(result.components!.map((entry) => entry.name)).toEqual(["Button", "Greeting"])
        expect(result.components![0].props![0].name).toBe("title")
      })
    })
  })

  describe("given empty inputs", () => {
    describe("when the meta manifest is built", () => {
      it("then returns only the schema version without empty sections", () => {
        const result = buildMeta({ docs: [], components: [], themeTokens: {}, qualifiers: [] })

        expect(result).toEqual({ schemaVersion: 1 })
      })
    })
  })

  describe("given theme tokens and style qualifiers", () => {
    const input = {
      themeTokens: {
        "Spacing.xs": "4px",
        "Palette.Blue.t60": "#0f62fe",
        "Colors.Bg.canvas": "light-dark({$Palette.Neutral.t0}, {$Palette.Blue.t60})",
      },
      qualifiers: [
        { name: "If", args: [{ name: "value", optional: false, kind: "boolean" as const, isFunction: false }] },
        {
          name: "OnRaising",
          diName: "OnRaisingQualifier",
          args: [
            {
              name: "event",
              optional: false,
              kind: "string" as const,
              isFunction: false,
              refKind: "event" as const,
            },
          ],
        },
      ],
    }

    describe("when the meta manifest is built", () => {
      it("then ships theme tokens key-sorted and qualifiers name-sorted", () => {
        const result = buildMeta(input, { package: "@acme/ui" })

        expect(Object.keys(result.themeTokens!)).toEqual(["Colors.Bg.canvas", "Palette.Blue.t60", "Spacing.xs"])
        expect(result.themeTokens!["Palette.Blue.t60"]).toBe("#0f62fe")
        expect(result.qualifiers!.map((q) => q.name)).toEqual(["If", "OnRaising"])
        expect(result.qualifiers![1].args[0].refKind).toBe("event")
      })

      it("then survives a JSON round-trip so a dependency can read the sections back", () => {
        const shipped = JSON.parse(JSON.stringify(buildMeta(input, { package: "@acme/ui" }))) as typeof input & {
          schemaVersion: number
        }

        expect(shipped.themeTokens["Colors.Bg.canvas"]).toBe("light-dark({$Palette.Neutral.t0}, {$Palette.Blue.t60})")
        expect(shipped.qualifiers.find((q) => q.name === "OnRaising")?.diName).toBe("OnRaisingQualifier")
      })
    })
  })
})
