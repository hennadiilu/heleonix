import path from "node:path"
import { readFileSync } from "node:fs"
import typescript from "@rollup/plugin-typescript"
import ts from "typescript"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import replace from "@rollup/plugin-replace"

export function createRollupConfig({ input = "./src/index.ts", tsconfig = "./tsconfig.json", external = [] } = {}) {
  const pkg = JSON.parse(readFileSync("./package.json", "utf8"))

  const externals = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...external,
  ]

  return {
    input,
    output: [
      {
        format: "cjs",
        exports: "named",
        dir: "dist",
        entryFileNames: "cjs/[name].cjs",
        preserveModulesRoot: "src",
      },
      {
        format: "esm",
        exports: "named",
        dir: "dist",
        entryFileNames: "esm/[name].js",
        preserveModulesRoot: "src",
      },
    ],
    external: (id) => externals.some((item) => id.startsWith(item)),
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        typescript: ts,
        rootDir: path.resolve("src"),
        tsconfig,
        declaration: true,
        declarationDir: path.resolve("dist/types"),
      }),
      replace({ preventAssignment: true, DEV: "process.env.NODE_ENV !== 'production'" }),
    ],
  }
}
