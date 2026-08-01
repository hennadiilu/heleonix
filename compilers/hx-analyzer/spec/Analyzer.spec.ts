import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Analyzer, createNodeTypeProgramHost } from "@heleonix/hx-analyzer"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_TEMPLATE } from "@heleonix/hx-language"

const dictionary = {
  path: "/src/Buttons.hxd",
  ext: EXT_DICTIONARY,
  name: "Buttons",
  dimension: {},
  source: `{ "save": "Save" }`,
}

const button = {
  path: "/src/Button.hxm",
  ext: EXT_TEMPLATE,
  name: "Button",
  dimension: {},
  source: `---
props: { variant?: 'primary' | 'default' }
---
<Component>
  <button>@Buttons.save</button>
</Component>`,
}

function analyzerWith(...files: (typeof button)[]): Analyzer {
  const analyzer = new Analyzer()

  // Stands in for the platform's generated hx.meta.json: native elements are
  // ordinary components in the metadata, so every tag is validated.
  analyzer.addMeta({
    schemaVersion: 1,
    components: ["button", "div", "span"].map((name) => ({ name, dimension: {}, open: true })),
  })

  for (const file of files) {
    analyzer.setFile(file)
  }

  return analyzer
}

describe("Analyzer", () => {
  describe("given a consistent snapshot of a dictionary and components", () => {
    const usage = {
      path: "/src/Form.hxm",
      ext: EXT_TEMPLATE,
      name: "Form",
      dimension: {},
      source: `<Component><Button name="save" title="@Buttons.save" /></Component>`,
    }

    describe("when the snapshot is analyzed", () => {
      it("then reports no diagnostics", async () => {
        const result = await analyzerWith(dictionary, button, usage).analyze()

        expect(result).toEqual([])
      })
    })
  })

  describe("given an unresolved dictionary reference", () => {
    const broken = { ...button, source: button.source.replace("@Buttons.save", "@Buttons.missing") }

    describe("when the snapshot is analyzed", () => {
      it("then reports the unknown dictionary entry", async () => {
        const result = await analyzerWith(dictionary, broken).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0002"])
      })
    })
  })

  describe("given an unknown component tag", () => {
    const usage = {
      path: "/src/Form.hxm",
      ext: EXT_TEMPLATE,
      name: "Form",
      dimension: {},
      source: `<Component><Buttn /></Component>`,
    }

    describe("when the snapshot is analyzed", () => {
      it("then reports the unknown component", async () => {
        const result = await analyzerWith(dictionary, button, usage).analyze()

        expect(result.map((entry) => entry.code)).toContain("HX_ANALYZER_0001")
      })
    })
  })

  describe("given a converter delivered from a dependency's hx.meta.json", () => {
    const usage = {
      path: "/src/Form.hxm",
      ext: EXT_TEMPLATE,
      name: "Form",
      dimension: {},
      source: `<Component><Button title="@Buttons.save | Lib(length: 3, size: 5)" /></Component>`,
    }

    function metaAnalyzer(): Analyzer {
      const analyzer = new Analyzer()

      analyzer.addMeta({
        schemaVersion: 1,
        components: [{ name: "button", dimension: {}, open: true }],
        converters: [{ name: "Lib", params: [{ name: "length", optional: false, kind: "number", isFunction: false }] }],
      })
      analyzer.setFile(dictionary)
      analyzer.setFile(button)
      analyzer.setFile(usage)

      return analyzer
    }

    describe("when the snapshot is analyzed", () => {
      it("then recognizes the library converter and validates its args from meta params", async () => {
        const result = await metaAnalyzer().analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0010"])
      })
    })
  })

  describe("given an unknown converter", () => {
    const usage = {
      path: "/src/Form.hxm",
      ext: EXT_TEMPLATE,
      name: "Form",
      dimension: {},
      source: `<Component><Button title="@Buttons.save | truncat" /></Component>`,
    }

    describe("when the snapshot is analyzed", () => {
      it("then reports the unknown converter", async () => {
        const result = await analyzerWith(dictionary, button, usage).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0009"])
      })
    })
  })

  describe("given state reads and writes in a component template", () => {
    function stateAnalyzer(body: string): Analyzer {
      const analyzer = new Analyzer()

      analyzer.addMeta({
        schemaVersion: 1,
        components: ["span", "input", "button"].map((name) => ({ name, dimension: {}, open: true })),
      })
      analyzer.setFile({
        path: "/src/Form.hxm",
        ext: EXT_TEMPLATE,
        name: "Form",
        dimension: {},
        source: `<Component>${body}</Component>`,
      })

      return analyzer
    }

    describe("when a read resolves to a state path written by an event capture", () => {
      it("then reports no diagnostics", async () => {
        const result = await stateAnalyzer(`<input input.target.value="userName" /><span>userName</span>`).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when a read resolves to a named child via control addressing", () => {
      it("then reports no diagnostics", async () => {
        const result = await stateAnalyzer(
          `<button name="actionBtn" click.type="lastEvent" /><span>actionBtn:click.type</span>`,
        ).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when a read resolves to nothing in the state pool", () => {
      it("then warns with the unknown-state-binding code", async () => {
        const result = await stateAnalyzer(`<input input.target.value="userName" /><span>usrName</span>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0104"])
      })
    })
  })

  describe("given an open native element delivered with a typed enum attribute via meta", () => {
    function nativeAnalyzer(usageSource: string): Analyzer {
      const analyzer = new Analyzer()

      analyzer.addMeta({
        schemaVersion: 1,
        components: [
          {
            name: "button",
            dimension: {},
            open: true,
            props: [
              {
                name: "type",
                optional: true,
                kind: "enum",
                enumValues: ["button", "submit", "reset"],
                isFunction: false,
              },
            ],
          },
        ],
      })
      analyzer.setFile({
        path: "/src/Form.hxm",
        ext: EXT_TEMPLATE,
        name: "Form",
        dimension: {},
        source: usageSource,
      })

      return analyzer
    }

    describe("when a valid enum value is bound", () => {
      it("then reports no diagnostics", async () => {
        const result = await nativeAnalyzer(`<Component><button type="'submit'" /></Component>`).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when an out-of-enum value is bound to the typed attribute", () => {
      it("then reports the prop type mismatch", async () => {
        const result = await nativeAnalyzer(`<Component><button type="'toggle'" /></Component>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0102"])
      })
    })

    describe("when an attribute outside the enumerated contract is bound", () => {
      it("then allows it (the element is open) and reports no diagnostics", async () => {
        const result = await nativeAnalyzer(`<Component><button data-role="'x'" class="'btn'" /></Component>`).analyze()

        expect(result).toEqual([])
      })
    })
  })

  describe("given a TypeScript program host and a component with an inline props type", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-analyzer-ts-"))

    const typedButton = {
      path: path.join(root, "Button.hxm"),
      ext: EXT_TEMPLATE,
      name: "Button",
      dimension: {},
      source: `---
props: { variant?: 'primary' | 'default'; count?: number; active?: boolean }
---
<Component><button /></Component>`,
    }

    const labels = {
      path: path.join(root, "Labels.hxd"),
      ext: EXT_DICTIONARY,
      name: "Labels",
      dimension: {},
      source: `{ "count": "5" }`,
    }

    const settings = {
      path: path.join(root, "Settings.hxc"),
      ext: EXT_CONFIG,
      name: "Settings",
      dimension: {},
      source: `{ "max": 40, "title": "Home" }`,
    }

    function typedAnalyzer(usageSource: string): Analyzer {
      const analyzer = new Analyzer()

      analyzer.setTypeProgramHost(createNodeTypeProgramHost(root))
      analyzer.addMeta({ schemaVersion: 1, components: [{ name: "button", dimension: {}, open: true }] })
      analyzer.setFile(typedButton)
      analyzer.setFile(labels)
      analyzer.setFile(settings)
      analyzer.setFile({
        path: path.join(root, "Form.hxm"),
        ext: EXT_TEMPLATE,
        name: "Form",
        dimension: {},
        source: usageSource,
      })

      return analyzer
    }

    beforeAll(() => {
      fs.writeFileSync(path.join(root, "tsconfig.json"), `{ "compilerOptions": { "strict": true, "noEmit": true } }`)
    })

    afterAll(() => {
      fs.rmSync(root, { recursive: true, force: true })
    })

    describe("when a valid enum value and a known prop are bound", () => {
      it("then reports no diagnostics", async () => {
        const result = await typedAnalyzer(`<Component><Button variant="'primary'" /></Component>`).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when an out-of-enum literal is bound", () => {
      it("then reports the prop type mismatch", async () => {
        const result = await typedAnalyzer(`<Component><Button variant="'flashy'" /></Component>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0102"])
      })
    })

    describe("when an undeclared prop is bound", () => {
      it("then reports the unknown prop", async () => {
        const result = await typedAnalyzer(`<Component><Button tone="'x'" /></Component>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0103"])
      })
    })

    describe("when a number literal matches a number prop", () => {
      it("then reports no diagnostics", async () => {
        const result = await typedAnalyzer(`<Component><Button count="5" /></Component>`).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when a string literal is bound to a number prop", () => {
      it("then reports the value kind mismatch", async () => {
        const result = await typedAnalyzer(`<Component><Button count="'5'" /></Component>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0105"])
      })
    })

    describe("when a number literal is bound to a boolean prop", () => {
      it("then reports the value kind mismatch", async () => {
        const result = await typedAnalyzer(`<Component><Button active="1" /></Component>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0105"])
      })
    })

    describe("when a dictionary reference (always string) is bound to a number prop", () => {
      it("then reports the value kind mismatch", async () => {
        const result = await typedAnalyzer(`<Component><Button count="@Labels.count" /></Component>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0105"])
      })
    })

    describe("when a config reference whose value type matches the prop is bound", () => {
      it("then reports no diagnostics", async () => {
        const result = await typedAnalyzer(`<Component><Button count="#Settings.max" /></Component>`).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when a config reference whose value type mismatches the prop is bound", () => {
      it("then reports the value kind mismatch", async () => {
        const result = await typedAnalyzer(`<Component><Button count="#Settings.title" /></Component>`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0105"])
      })
    })

    describe("when a state binding is bound to a typed prop", () => {
      it("then stays gradual and reports no diagnostics", async () => {
        const result = await typedAnalyzer(`<Component><Button count="counter" /></Component>`).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when a converter is declared as a discovered TypeScript class", () => {
      beforeAll(() => {
        fs.writeFileSync(
          path.join(root, "bases.ts"),
          `export abstract class Converter<V = unknown, R = unknown, P = object> {
             abstract format(value: V, params: P): Promise<R>
           }`,
        )
        fs.writeFileSync(
          path.join(root, "TruncateConverter.ts"),
          `import { Converter } from "./bases"
           interface TruncateParams { length: number; ellipsis?: 'dots' | 'none' }
           export class TruncateConverter extends Converter<string, string, TruncateParams> {
             async format(value: string, params: TruncateParams) { return value.slice(0, params.length) }
           }`,
        )
        fs.writeFileSync(
          path.join(root, "WrapConverter.ts"),
          `import { Converter } from "./bases"
           interface WrapParams { items: string[]; meta: { threshold: number } }
           export class WrapConverter extends Converter<string, string, WrapParams> {
             async format(value: string, params: WrapParams) { return value + params.items.length + params.meta.threshold }
           }`,
        )
      })

      function converterAnalyzer(chain: string): Analyzer {
        const analyzer = new Analyzer()

        analyzer.setTypeProgramHost(createNodeTypeProgramHost(root))
        analyzer.addMeta({ schemaVersion: 1, components: [{ name: "span", dimension: {}, open: true }] })
        analyzer.setFile({
          path: path.join(root, "Form.hxm"),
          ext: EXT_TEMPLATE,
          name: "Form",
          dimension: {},
          source: `<Component><span>data | ${chain}</span></Component>`,
        })

        return analyzer
      }

      it("then recognizes a valid call by its derived name with correct args", async () => {
        const result = await converterAnalyzer(`Truncate(length: 3, ellipsis: 'dots')`).analyze()

        expect(result).toEqual([])
      })

      it("then reports an unknown argument", async () => {
        const result = await converterAnalyzer(`Truncate(length: 3, size: 5)`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0010"])
      })

      it("then reports a missing required argument", async () => {
        const result = await converterAnalyzer(`Truncate(ellipsis: 'dots')`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0011"])
      })

      it("then reports an out-of-enum argument value", async () => {
        const result = await converterAnalyzer(`Truncate(length: 3, ellipsis: 'stars')`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0102"])
      })

      it("then supports nested object and array params, staying gradual for bound values", async () => {
        const result = await converterAnalyzer(`Wrap(items: someState, meta: otherState)`).analyze()

        expect(result).toEqual([])
      })

      it("then still resolves nested params enough to require them", async () => {
        const result = await converterAnalyzer(`Wrap(items: someState)`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0011"])
      })
    })

    describe("when an action is declared as a discovered TypeScript class", () => {
      beforeAll(() => {
        fs.writeFileSync(
          path.join(root, "actionBases.ts"),
          `export abstract class Action<P = object> {
             abstract Execute(params: P): Promise<void>
           }`,
        )
        // \`readonly id\`/\`label\` are inputs (any source); mutable \`result\` is
        // in-out (must bind a writable state path).
        fs.writeFileSync(
          path.join(root, "SubmitAction.ts"),
          `import { Action } from "./actionBases"
           interface SubmitParams { readonly id: number; readonly label?: string; result: string }
           export class SubmitAction extends Action<SubmitParams> {
             async Execute(params: SubmitParams) { void params }
           }`,
        )
      })

      function executeAnalyzer(attributes: string): Analyzer {
        const analyzer = new Analyzer()

        analyzer.setTypeProgramHost(createNodeTypeProgramHost(root))
        analyzer.setFile(labels)
        analyzer.setFile({
          path: path.join(root, "Form.hxm"),
          ext: EXT_TEMPLATE,
          name: "Form",
          dimension: {},
          source: `<Component><Execute ${attributes} /></Component>`,
        })

        return analyzer
      }

      it("then recognizes a valid call with a readonly input and a writable in-out param", async () => {
        const result = await executeAnalyzer(`action="Submit" id="1" result="output"`).analyze()

        expect(result).toEqual([])
      })

      it("then accepts a non-writable source (dictionary) for a readonly input", async () => {
        const result = await executeAnalyzer(`action="Submit" id="1" result="output" label="@Labels.count"`).analyze()

        expect(result).toEqual([])
      })

      it("then reports an unknown action", async () => {
        const result = await executeAnalyzer(`action="Nope"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0014"])
      })

      it("then reports an unknown action argument", async () => {
        const result = await executeAnalyzer(`action="Submit" id="1" result="output" bogus="2"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0015"])
      })

      it("then reports a missing required action argument", async () => {
        const result = await executeAnalyzer(`action="Submit" result="output"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0016"])
      })

      it("then reports a value kind mismatch on a data argument", async () => {
        const result = await executeAnalyzer(`action="Submit" id="'x'" result="output"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0105"])
      })

      it("then reports a non-writable binding for a mutable in-out param", async () => {
        const result = await executeAnalyzer(`action="Submit" id="1" result="'frozen'"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0017"])
      })

      it("then skips validation for a dynamic action name", async () => {
        const result = await executeAnalyzer(`action="state.action"`).analyze()

        expect(result).toEqual([])
      })
    })

    describe("when a programmatic component is declared as a discovered TypeScript class", () => {
      beforeAll(() => {
        fs.writeFileSync(
          path.join(root, "componentBases.ts"),
          `export abstract class Component<TProps = object, TEvents = object> {
             declare protected readonly __props?: TProps
             declare protected readonly __events?: TEvents
           }`,
        )
        fs.writeFileSync(
          path.join(root, "Card.ts"),
          `import { Component } from "./componentBases"
           interface CardProps { variant?: 'primary' | 'secondary'; count?: number }
           export class Card extends Component<CardProps> {}`,
        )
      })

      function cardAnalyzer(attributes: string): Analyzer {
        const analyzer = new Analyzer()

        analyzer.setTypeProgramHost(createNodeTypeProgramHost(root))
        analyzer.setFile({
          path: path.join(root, "Form.hxm"),
          ext: EXT_TEMPLATE,
          name: "Form",
          dimension: {},
          source: `<Component><Card ${attributes} /></Component>`,
        })

        return analyzer
      }

      it("then recognizes the tag (class name) and accepts a valid prop", async () => {
        const result = await cardAnalyzer(`variant="'primary'" count="3"`).analyze()

        expect(result).toEqual([])
      })

      it("then reports an out-of-enum prop value", async () => {
        const result = await cardAnalyzer(`variant="'huge'"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0102"])
      })

      it("then reports an undeclared prop", async () => {
        const result = await cardAnalyzer(`bogus="1"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0103"])
      })

      it("then reports a value kind mismatch", async () => {
        const result = await cardAnalyzer(`count="'x'"`).analyze()

        expect(result.map((entry) => entry.code)).toEqual(["HX_ANALYZER_0105"])
      })

      it("then exposes the component with its members and class location", async () => {
        const analyzer = cardAnalyzer(`variant="'primary'"`)
        await analyzer.analyze()

        const card = analyzer.components().find((info) => info.name === "Card")

        expect(card?.members.map((member) => member.name).sort()).toEqual(["count", "variant"])
        expect(card?.file).toContain("Card.ts")
        expect(card?.open).toBe(false)
      })
    })

    describe("when a component's props type declares a function member", () => {
      it("then reports the no-functions guardrail violation at the header", async () => {
        const analyzer = new Analyzer()

        analyzer.setTypeProgramHost(createNodeTypeProgramHost(root))
        analyzer.setFile({
          path: path.join(root, "Fancy.hxm"),
          ext: EXT_TEMPLATE,
          name: "Fancy",
          dimension: {},
          source: `---
props: { onClick?: () => void }
---
<Component><span /></Component>`,
        })

        const result = await analyzer.analyze()

        expect(result.map((entry) => entry.code)).toContain("HX_ANALYZER_0101")
      })
    })
  })
})
