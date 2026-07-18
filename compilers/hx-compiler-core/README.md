# @heleonix/hx-compiler-core

Common foundation for Heleonix compilers.

Provides:

- A small, dependency-free, platform-independent XML parser tailored for the Heleonix file formats (`*.hxd`, `*.hxc`, `*.hxm`, `*.hxs`, `*.hxt`).
- The base `XmlCompiler<T>` and `JsoncCompiler<T>` classes, each with the async `compile(source, dimension, options)` API.
- Shared types (`IDimension`, `ICompilerOptions`) and binding-expression parsing utilities used by all compilers.
- A base error type (`HeleonixCompilerError`) and common error codes (XML parsing, empty source, invalid root element). Format-specific compilers extend this with their own `Heleonix*CompilerError` types.

The package is platform-independent (runs in both browser and Node.js), has no external dependencies, and is designed to be tree-shakeable so build-time plugins (Rollup, esbuild, Vite, webpack) only ship the parts they need.
