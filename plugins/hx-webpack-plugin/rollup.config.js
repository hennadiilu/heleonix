import { createRollupConfig } from "../../tools/rollup.js"

// The loader must be emitted as its own entry so `HxWebpackPlugin` can resolve it
// as a sibling file (`dist/esm/hxWebpackLoader.js`) and webpack can load it standalone.
export default createRollupConfig({
  input: {
    index: "./src/index.ts",
    hxWebpackLoader: "./src/hxWebpackLoader.ts",
  },
})
