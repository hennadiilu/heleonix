# @heleonix/hx-plugin-core

The bundler-agnostic core of the Heleonix build plugins - everything a webpack, rollup, esbuild or vite integration
shares, so each stays a thin adapter to its bundler and all of them build a package alike. Node-only; the compilers
it drives stay usable anywhere.

## Configuration

- `loadHxConfig(dir, host?)` - the `hx.config.json` governing a directory, merged over what it `extends`. Never
  throws: the result carries the configuration, every file read (to watch for changes), every place one was looked
  for in vain (to watch for one appearing) and a load error with the file and offset at fault. `host` reads the
  files - `NODE_CONFIG_HOST` by default; an editor passes one reading its unsaved documents.
- `resolveBuildSettings(context, options?, host?)` - a build's settings: the bundler plugin's options over the
  package's configuration over the defaults.
- `buildLevelOf(code, own, settings)` - how a build reports a finding: `error`, `warning`, or not at all.
- `configReportOf(lookup)` - a configuration's load error as a build error, with its line and column.
- `findWorkspacePackages(root)` - the packages a workspace manifest declares.

## Building a package

- `scan`, `parseAssetFileName`, `isIncludedSource` - the sources a build compiles, named under its dimensions.
- `compileAsset` - a source's definition; `CompiledAssets` - definitions, docs and headers cached per change.
- `generateDefinitionSource`, `generateDefinitionDeclarations` - the definition-source modules an application
  registers.
- `packageTypeHosts(context, settings)` - the package's own TypeScript projects.
- `PackageValidation` - the analysis editors run, across rebuilds, reported at build levels.
- `PackageMetaBuilder` - the package's `hx.meta.json`: its sources' docs, contracts, theme tokens and controls, and
  the converters, actions, style qualifiers and programmatic components its TypeScript declares.
- `loadDependencyMetas(context)` - the manifests of what a package installs.

## Writing an integration

A bundler plugin resolves its settings once and again whenever a file in `settings.lookup.files` or
`settings.lookup.missing` changes (registering both as watch dependencies), reports `configReportOf(settings.lookup)`
as an error, scans and compiles the sources, and - when validating or emitting a manifest - shares one
`PackageValidation` and `PackageMetaBuilder` per settings across rebuilds. `@heleonix/hx-webpack-plugin` is the
reference integration.
