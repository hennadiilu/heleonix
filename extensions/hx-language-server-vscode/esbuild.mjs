import { buildNodeBundles } from "../../tools/esbuild.js"

// Bundles the extension client and the language server into dist/ in one step,
// so the extension is self-contained (no copy/staging step needed).
await buildNodeBundles({
  entryPoints: {
    extension: "src/extension.ts",
    server: "../hx-language-server/src/server.ts",
  },
  external: ["vscode"],
  watch: process.argv.includes("--watch"),
})
