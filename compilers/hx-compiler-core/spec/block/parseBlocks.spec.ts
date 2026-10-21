import { parseBlocks } from "@heleonix/hx-compiler-core"

describe("parseBlocks", () => {
  describe("given bare declarations", () => {
    it("then parses name/value pairs and trims them", () => {
      const doc = parseBlocks("width: 8px;\ncolor:  red ;")

      expect(doc.nodes).toEqual([
        { kind: "declaration", name: "width", value: "8px", start: 0 },
        { kind: "declaration", name: "color", value: "red", start: 12 },
      ])
    })

    it("then keeps `{...}` interpolations intact in values", () => {
      const doc = parseBlocks("box-shadow: 10px {someProp}px {$Colors.Roles.Primary.bg};")

      expect(doc.nodes).toEqual([
        { kind: "declaration", name: "box-shadow", value: "10px {someProp}px {$Colors.Roles.Primary.bg}", start: 0 },
      ])
    })

    it("then accepts a final declaration with no trailing semicolon", () => {
      const doc = parseBlocks("Colors { primary: red }")

      expect(doc.nodes).toEqual([
        {
          kind: "block",
          prelude: "Colors",
          start: 0,
          nodes: [{ kind: "declaration", name: "primary", value: "red", start: 9 }],
        },
      ])
    })
  })

  describe("given a pseudo block", () => {
    it("then a leading `:` is a prelude, not a declaration split", () => {
      const doc = parseBlocks(":hover { padding: 4px; }")

      expect(doc.nodes).toEqual([
        {
          kind: "block",
          prelude: ":hover",
          start: 0,
          nodes: [{ kind: "declaration", name: "padding", value: "4px", start: 9 }],
        },
      ])
    })

    it("then a pseudo-element `::before` is also a prelude", () => {
      const doc = parseBlocks("::before { content: '*'; }")

      expect(doc.nodes).toEqual([
        {
          kind: "block",
          prelude: "::before",
          start: 0,
          nodes: [{ kind: "declaration", name: "content", value: "'*'", start: 11 }],
        },
      ])
    })
  })

  describe("given nested blocks", () => {
    it("then nests children under their parent prelude", () => {
      const doc = parseBlocks(":hover { @media (max-width: 600px) { color: #123; } }")

      expect(doc.nodes).toEqual([
        {
          kind: "block",
          prelude: ":hover",
          start: 0,
          nodes: [
            {
              kind: "block",
              prelude: "@media (max-width: 600px)",
              start: 9,
              nodes: [{ kind: "declaration", name: "color", value: "#123", start: 37 }],
            },
          ],
        },
      ])
    })
  })

  describe("given an at-rule with a `:` inside parens", () => {
    it("then does not split it as a declaration", () => {
      const doc = parseBlocks("@media (max-width: 600px) { color: red; }")

      expect(doc.nodes[0]).toEqual({
        kind: "block",
        prelude: "@media (max-width: 600px)",
        start: 0,
        nodes: [{ kind: "declaration", name: "color", value: "red", start: 28 }],
      })
    })

    it("then keeps a brace interpolation inside qualifier args in the prelude", () => {
      const doc = parseBlocks("@hx-if(value: {isSaving}) { animation: pulse; }")

      expect(doc.nodes[0]).toEqual({
        kind: "block",
        prelude: "@hx-if(value: {isSaving})",
        start: 0,
        nodes: [{ kind: "declaration", name: "animation", value: "pulse", start: 28 }],
      })
    })
  })

  describe("given a `{$...}` interpolation in prelude position (named media condition)", () => {
    it("then treats the `$`-led brace as interpolation and the next brace as the block", () => {
      const doc = parseBlocks("@media {$Media.compact} { color: red; }")

      expect(doc.nodes[0]).toEqual({
        kind: "block",
        prelude: "@media {$Media.compact}",
        start: 0,
        nodes: [{ kind: "declaration", name: "color", value: "red", start: 26 }],
      })
    })
  })

  describe("given a `;`-terminated statement without a top-level colon", () => {
    it("then parses it as a statement", () => {
      const doc = parseBlocks("@hx-apply(token: Type.Body);")

      expect(doc.nodes).toEqual([{ kind: "statement", text: "@hx-apply(token: Type.Body)", start: 0 }])
    })
  })

  describe("given comments", () => {
    it("then strips `/* */` and `//` between nodes", () => {
      const doc = parseBlocks("/* block */ width: 8px; // trailing\ncolor: red;")

      expect(doc.nodes).toEqual([
        { kind: "declaration", name: "width", value: "8px", start: 12 },
        { kind: "declaration", name: "color", value: "red", start: 36 },
      ])
    })

    it("then does not treat `//` inside url() parens as a comment", () => {
      const doc = parseBlocks("background: url(https://example.com/a.png);")

      expect(doc.nodes).toEqual([
        { kind: "declaration", name: "background", value: "url(https://example.com/a.png)", start: 0 },
      ])
    })

    it("then does not treat `/*` inside a quoted string as a comment", () => {
      const doc = parseBlocks("content: '/*';")

      expect(doc.nodes).toEqual([{ kind: "declaration", name: "content", value: "'/*'", start: 0 }])
    })
  })

  describe("given a `/** */` doc comment before a node", () => {
    it("then attaches the raw doc comment to the following node", () => {
      const doc = parseBlocks("/** Attention pulse. */\n@keyframes pulse { from { opacity: 0; } }")

      expect(doc.nodes[0].doc).toBe("/** Attention pulse. */")
      expect(doc.nodes[0].kind).toBe("block")
    })
  })

  describe("given a deep theme group", () => {
    it("then builds the nested group/token tree", () => {
      const doc = parseBlocks("Colors { Roles { Primary { bg: {$Palette.Blue.t60}; } } }")

      expect(doc.nodes).toEqual([
        {
          kind: "block",
          prelude: "Colors",
          start: 0,
          nodes: [
            {
              kind: "block",
              prelude: "Roles",
              start: 9,
              nodes: [
                {
                  kind: "block",
                  prelude: "Primary",
                  start: 17,
                  nodes: [{ kind: "declaration", name: "bg", value: "{$Palette.Blue.t60}", start: 27 }],
                },
              ],
            },
          ],
        },
      ])
    })
  })

  describe("given keyframe frame selectors", () => {
    it("then keeps multi-stop and percentage preludes", () => {
      const doc = parseBlocks("@keyframes pulse { from, to { transform: scale(1); } 50% { transform: scale({s}); } }")

      const frames = (doc.nodes[0] as { nodes: { prelude: string }[] }).nodes

      expect(frames[0].prelude).toBe("from, to")
      expect(frames[1].prelude).toBe("50%")
    })
  })
})
