import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { findWorkspacePackages } from "@heleonix/hx-plugin-core"

describe("findWorkspacePackages", () => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "hx-workspace-")))

  const write = (file: string, content: unknown): void => {
    const target = path.join(root, file)

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content))
  }

  const packagesOf = (dir: string): string[] | undefined =>
    findWorkspacePackages(path.join(root, dir))?.map((found) => path.relative(path.join(root, dir), found) || ".")

  beforeAll(() => {
    for (const workspace of ["pnpm", "flow", "npm", "yarn", "lerna", "none"]) {
      write(`${workspace}/package.json`, { name: workspace })
      write(`${workspace}/apps/web/package.json`, { name: "web" })
      write(`${workspace}/packages/ui/package.json`, { name: "ui" })
      write(`${workspace}/packages/ui/test/fixture/package.json`, { name: "fixture" })
      write(`${workspace}/packages/ui/node_modules/dep/package.json`, { name: "dep" })
      write(`${workspace}/examples/demo/package.json`, { name: "demo" })
    }

    write(
      "pnpm/pnpm-workspace.yaml",
      `# the workspace\npackages:\n  - "apps/*"\n  - 'packages/**'\n  - "!**/test/**" # fixtures\ncatalog:\n  react: ^19\n`,
    )
    write("flow/pnpm-workspace.yaml", `packages: [apps/*, "packages/*"]\n`)
    write("npm/package.json", { name: "npm", workspaces: ["apps/*", "packages/*"] })
    write("yarn/package.json", { name: "yarn", workspaces: { packages: ["packages/*"], nohoist: ["**/x"] } })
    write("lerna/lerna.json", { packages: ["apps/*"] })
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reads pnpm's block and flow lists, honouring negations", () => {
    expect(packagesOf("pnpm")?.sort()).toEqual([".", path.join("apps", "web"), path.join("packages", "ui")])
    expect(packagesOf("flow")?.sort()).toEqual([".", path.join("apps", "web"), path.join("packages", "ui")])
  })

  it("then reads npm's and yarn's workspaces, and lerna's packages", () => {
    expect(packagesOf("npm")?.sort()).toEqual([".", path.join("apps", "web"), path.join("packages", "ui")])
    expect(packagesOf("yarn")?.sort()).toEqual([".", path.join("packages", "ui")])
    expect(packagesOf("lerna")?.sort()).toEqual([".", path.join("apps", "web")])
  })

  it("then declares nothing for a root without a workspace manifest", () => {
    expect(packagesOf("none")).toBeUndefined()
  })
})
