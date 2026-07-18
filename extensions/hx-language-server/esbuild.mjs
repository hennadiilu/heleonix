import { buildNodeBundles } from "../../tools/esbuild.js"

await buildNodeBundles({
  entryPoints: { server: "src/server.ts" },
  watch: process.argv.includes("--watch"),
})
