# DSL design rules

Read this before adding or changing DSL syntax, file formats, or compilers.

- `README.md` is the authoritative design spec for the DSL: dimensions, mergeable resources, file format syntax and examples. Align any new language feature with it first; if a feature contradicts the spec, update the spec in the same change or don't build it.
- The DSL file formats and where they are handled:

  | Extension | Resource     | Compiler package                     |
  | --------- | ------------ | ------------------------------------ |
  | `.hxm`    | components   | `compilers/hx-compiler-components`   |
  | `.hxd`    | dictionaries | `compilers/hx-compiler-dictionaries` |
  | `.hxc`    | configs      | `compilers/hx-compiler-configs`      |
  | `.hxs`    | styles       | `compilers/hx-compiler-styles`       |
  | `.hxt`    | themes       | `compilers/hx-compiler-themes`       |
  | `.hxp`    | shapes       | `compilers/hx-compiler-shapes`       |

- Shared token/type/grammar definitions live in `common/hx-language`; definition interfaces (`IComponentDefinition`, `IDictionaryDefinition`, ...) are typed there, not in compiler packages.
- Compilers extend `hx-compiler-core`'s `XmlCompiler`/`JsoncCompiler` base classes rather than parsing from scratch.
- A language change usually has three consumers that must stay in sync: the compiler (build output), `runtime/hx-core` managers (consumption), and `extensions/hx-language-server` + `hx-language-server-vscode` TextMate grammars (diagnostics/highlighting). Check all three before considering the change done.
- Dictionaries, configs, styles, and themes are mergeable across dimensions (`usage: extend|override` frontmatter). Merge semantics are implemented in `common/hx-language/src/dimensions/` and `common/hx-utils`'s `Merger.mergeDeeply` — extend those, don't reimplement merging locally.
- Verify changes against `playground/hx-sandbox`, the de-facto integration test target.
