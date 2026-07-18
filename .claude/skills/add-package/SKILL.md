---
name: add-package
description: Create a new @heleonix/* workspace package with the standard rollup/api-extractor build shape and wire it into the monorepo.
---

# Add a new workspace package

Follow these steps to create a new library package. Use `common/hx-utils` as the reference implementation for every file mentioned.

1. **Pick the area folder** matching the package's role: `common/`, `runtime/`, `compilers/`, `platforms/`, `plugins/`, `extensions/`, `playground/`, `cli/`, `devtools/`, `testing/`, `linting/`, or `ssr/` (all are already in `pnpm-workspace.yaml`). Create `<area>/<hx-name>/`.

2. **`package.json`** — copy from `common/hx-utils/package.json` and adjust:
   - `name`: `@heleonix/<hx-name>` (folder name without the scope)
   - `description`, `repository.directory`
   - Keep: `"type": "module"`, `main`/`module`/`types` pointing into `dist/`, `exports` map, `files`, `sideEffects: false`, and the `clean`/`build`/`dts` scripts (`rimraf dist temp` / `rollup -c` / `api-extractor run -l`). Root `pnpm build`/`pnpm dts`/`pnpm clean` fan out to these names — a package only participates if it defines them.
   - **No external runtime dependencies.** Only other `@heleonix/*` workspace packages (as `"workspace:*"`) may appear in `dependencies`/`peerDependencies`; those keys are auto-treated as rollup externals.

3. **`tsconfig.json`**:

   ```json
   {
     "extends": "../../tools/tsconfig.base.json",
     "compilerOptions": { "rootDir": "src", "outDir": "dist" },
     "include": ["src"]
   }
   ```

4. **`rollup.config.js`**:

   ```js
   import { createRollupConfig } from "../../tools/rollup.js"

   export default createRollupConfig()
   ```

5. **`api-extractor.json`**:

   ```json
   {
     "extends": "../../tools/api-extractor.base.json",
     "projectFolder": "."
   }
   ```

6. **Register the TS path alias** in `tools/tsconfig.paths.json`: add `"@heleonix/<hx-name>": ["../<area>/<hx-name>/src"]`. Cross-package imports will not resolve without this.

7. **`src/`** — create `src/index.ts` as the single aggregation point (`export * from "./..."` lines only). Follow the one-export-per-file convention: each `.ts` file exports exactly one named thing matching its filename.

8. **Verify**: `pnpm install`, then `pnpm --filter @heleonix/<hx-name> run build` and `run dts`, then `tsc --noEmit` and `pnpm exec eslint .` from the root.

Exception: packages bundling for a Node/VSCode host (like `extensions/hx-language-server-vscode`, `extensions/hx-language-server`) use esbuild (`esbuild.mjs`) instead of steps 4–5 — copy from those packages instead.