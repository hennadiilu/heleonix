import { globToRegExp } from "../src/globToRegExp"

function matches(glob: string, paths: string[]): boolean[] {
  const pattern = globToRegExp(glob)

  return paths.map((candidate) => pattern.test(candidate))
}

describe("globToRegExp", () => {
  it("then spans any number of whole segments with `**/`, none included", () => {
    expect(matches("**/tsconfig.json", ["tsconfig.json", "a/b/tsconfig.json", "a/xtsconfig.json"])).toEqual([
      true,
      true,
      false,
    ])
  })

  it("then keeps `*` and `?` within one segment", () => {
    expect(matches("packages/*/tsconfig.?son", ["packages/ui/tsconfig.json", "packages/a/b/tsconfig.json"])).toEqual([
      true,
      false,
    ])
  })

  it("then matches everything below a folder with a trailing `/**`", () => {
    expect(matches("**/spec/**", ["spec/a.ts", "pkg/spec/deep/b.ts", "pkg/specs/c.ts"])).toEqual([true, true, false])
  })

  it("then reads `{a,b}` as alternatives and every other character literally", () => {
    expect(matches("**/*.{spec,test}.ts", ["a.spec.ts", "b/c.test.ts", "d.specxts", "e.ts"])).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect(matches("a+b(1).json", ["a+b(1).json", "aab1.json"])).toEqual([true, false])
  })
})
