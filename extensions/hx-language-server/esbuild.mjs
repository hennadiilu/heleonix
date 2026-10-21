import { buildNodeBundles } from "../../tools/esbuild.js"

await buildNodeBundles({
  entryPoints: { server: "src/server.ts" },
  watch: process.argv.includes("--watch"),
  // Runnable as the package's `hx-language-server` command by any LSP host.
  banner: { js: "#!/usr/bin/env node" },
})
