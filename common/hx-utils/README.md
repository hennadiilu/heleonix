# @heleonix/hx-utils

Dependency-free, performance-oriented utilities shared across the Heleonix
framework: compilers, the runtime, platforms, and tooling.

The package is purely declarative in shape — each exported class groups one
concern and exposes static methods. No internal dependencies, no side effects.

## Groups

- `Merger` — in-place deep merge of plain objects.

## `Merger.mergeDeeply(base, extension)`

Recursively overlays `extension` onto `base`, then returns `base`.

- **Mutates and returns `base`** — no result object is allocated.
- **Standalone result** — plain objects and arrays taken from `extension` are
  deep-copied into `base`, so the returned structure shares no references with
  `extension`. Only values originating from `extension` are allocated; values
  already held by `base` stay in place.
- **Plain objects are merged key by key; arrays are replaced whole** (and
  deep-copied). Functions and class instances (`Date`, `Map`, `RegExp`, …)
  can't be cloned generically and are assigned by reference — clone them
  beforehand if they must be isolated too.
- **Prototype-pollution safe** — `__proto__` keys are skipped.

```ts
import { Merger } from "@heleonix/hx-utils"

const base = { a: 1, nested: { x: 1, y: 2 }, list: [1, 2] }
const extension = { b: 2, nested: { y: 20, z: 30 }, list: [9] }

const merged = Merger.mergeDeeply(base, extension)

// merged === base
// {
//   a: 1,
//   b: 2,
//   nested: { x: 1, y: 20, z: 30 },
//   list: [9],
// }
```
