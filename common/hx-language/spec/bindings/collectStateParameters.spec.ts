import { collectStateParameters } from "@heleonix/hx-language"

describe("collectStateParameters", () => {
  describe("given a template with plain state interpolations", () => {
    describe("when the state parameters are collected", () => {
      it("then returns the distinct state paths", () => {
        const result = collectStateParameters("Hi {user}, you have {count} items, {user}!")

        expect(result).toEqual(["user", "count"])
      })
    })
  })

  describe("given interpolations whose sources are dictionary or config references", () => {
    describe("when the state parameters are collected", () => {
      it("then omits them, since they react to dimension switches instead", () => {
        const result = collectStateParameters("{@Other.key} and {#Cfg.path}")

        expect(result).toEqual([])
      })
    })
  })

  describe("given a converter chain with state-typed arguments", () => {
    describe("when the state parameters are collected", () => {
      it("then includes both the source and the state arguments, but not literals or configs", () => {
        const result = collectStateParameters("{name | Truncate(length: max, unit: #Cfg.u, pad: 3)}")

        expect(result).toEqual(["name", "max"])
      })
    })
  })
})
