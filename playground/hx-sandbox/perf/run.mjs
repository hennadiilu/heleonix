import { build } from "esbuild"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, "../../..")
const out = path.join(dir, ".bundle.mjs")

// Bundle the harness straight from workspace source (no prior build needed),
// resolving @heleonix/* to each package's src via aliases.
await build({
  entryPoints: [path.join(dir, "harness.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: out,
  logLevel: "warning",
  define: { DEV: "false" },
  alias: {
    "@heleonix/hx-core": path.join(root, "runtime/hx-core/src/index.ts"),
    "@heleonix/hx-language": path.join(root, "common/hx-language/src/index.ts"),
    "@heleonix/hx-utils": path.join(root, "common/hx-utils/src/index.ts"),
  },
})

const result = spawnSync(process.execPath, ["--expose-gc", out], { stdio: "inherit" })

process.exit(result.status ?? 1)
