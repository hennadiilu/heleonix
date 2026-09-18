import { performance } from "node:perf_hooks"
import {
  BindingEvaluator,
  ConfigValueSource,
  Converter,
  DictionaryValueSource,
  LiteralValueSource,
  StateValueSource,
  isThenable,
} from "@heleonix/hx-core"
import type { IConverterContext } from "@heleonix/hx-core"
import { Binder } from "../../../runtime/hx-core/src/bindings/Binder"
import { ConverterProvider } from "../../../runtime/hx-core/src/converters/ConverterProvider"
import { StateManager } from "../../../runtime/hx-core/src/state/StateManager"
import { joinFQPropertyName } from "@heleonix/hx-language"
import type { IBindingExpression } from "@heleonix/hx-language"

class FakeConfigDefinitionLoader {
  public loadDefinition(): Promise<undefined> {
    return Promise.resolve(undefined)
  }
}

class FakeDictionaryDefinitionLoader {
  public loadDefinition(): Promise<undefined> {
    return Promise.resolve(undefined)
  }
}

// Same transform, two flavors: one returns synchronously, one wraps in a promise.
class SyncConverter extends Converter<unknown, unknown, { factor: number }> {
  public static readonly hxName = "Sync"

  public format(value: unknown, params: { factor: number }): number {
    return Number(value) * params.factor
  }

  public parse(value: unknown, params: { factor: number }): number {
    return Number(value) / params.factor
  }
}

class AsyncConverter extends Converter<unknown, unknown, { factor: number }> {
  public static readonly hxName = "Async"

  public format(value: unknown, params: { factor: number }): Promise<number> {
    return Promise.resolve(Number(value) * params.factor)
  }

  public parse(value: unknown, params: { factor: number }): Promise<number> {
    return Promise.resolve(Number(value) / params.factor)
  }
}

// A bare converter (no arguments) to exercise the shared-empty-args path.
class BareConverter extends Converter<unknown, unknown, object> {
  public static readonly hxName = "Bare"

  public format(value: unknown): number {
    return Number(value) + 1
  }

  public parse(value: unknown): number {
    return Number(value) - 1
  }
}

interface Graph {
  state: StateManager
  binder: Binder
  evaluator: BindingEvaluator
}

function makeGraph(): Graph {
  const state = new StateManager()
  // Converters here ignore their context, so a bare shell satisfies the seam.
  const converterProvider = new ConverterProvider(
    new Map<string, new (context: IConverterContext) => Converter>([
      ["Sync", SyncConverter],
      ["Async", AsyncConverter],
      ["Bare", BareConverter],
    ]),
    () => ({}) as IConverterContext,
  )
  const evaluator = new BindingEvaluator(converterProvider, [
    new StateValueSource(state),
    new LiteralValueSource(),
    new ConfigValueSource(new FakeConfigDefinitionLoader() as never),
    new DictionaryValueSource(new FakeDictionaryDefinitionLoader() as never),
  ])

  return { state, binder: new Binder(state, evaluator), evaluator }
}

function heapUsedMb(): number {
  const g = (globalThis as unknown as { gc?: () => void }).gc

  g?.()
  g?.()

  return process.memoryUsage().heapUsed / (1024 * 1024)
}

const binding = (value: string, converter: string): IBindingExpression => ({
  type: "state",
  value,
  converters: [`${converter}(factor: 2)`],
})

// Resolve the same binding many times, only awaiting when the converter is async
// (a sync converter resolves entirely off the microtask queue).
async function benchResolve(iterations: number, expr: IBindingExpression): Promise<number> {
  const { evaluator, state } = makeGraph()
  state.setValue(joinFQPropertyName("app", "v"), 21)

  for (let i = 0; i < 20000; i++) {
    const value = evaluator.resolve(expr, "app")
    if (isThenable(value)) await value
  }

  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    const value = evaluator.resolve(expr, "app")
    if (isThenable(value)) await value
  }

  return performance.now() - start
}

// The real INP path: a state change drives format -> write. With a sync
// converter this whole cascade runs inside setValue, in the same task.
async function benchRecompute(iterations: number, converter: string): Promise<number> {
  const { state, binder } = makeGraph()
  const source = joinFQPropertyName("app", "src")

  state.setValue(source, 1)
  await binder.bind("view:out", binding("src", converter), "app")

  for (let i = 0; i < 20000; i++) {
    state.setValue(source, i)
  }

  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    state.setValue(source, i + 1_000_000)
  }

  return performance.now() - start
}

// Bind N bindings, awaiting only the ones that are actually async. A sync
// binding (state edge, literal, or a sync-converter chain) now mounts without a
// promise, so this loop stays on the main task.
async function benchBind(count: number, makeBinding: (i: number) => IBindingExpression): Promise<number> {
  const { state, binder } = makeGraph()

  for (let i = 0; i < count; i++) {
    state.setValue(joinFQPropertyName("app", `v${i}`), i)
  }

  const start = performance.now()

  for (let i = 0; i < count; i++) {
    const result = binder.bind(`C${i}:out`, makeBinding(i), "app")
    if (isThenable(result)) await result
  }

  return performance.now() - start
}

async function benchHeap(count: number, converter: string): Promise<number> {
  const { state, binder } = makeGraph()

  for (let i = 0; i < count; i++) {
    state.setValue(joinFQPropertyName("app", `v${i}`), i)
  }

  const before = heapUsedMb()

  for (let i = 0; i < count; i++) {
    await binder.bind(`C${i}:out`, binding(`v${i}`, converter), "app")
  }

  const after = heapUsedMb()

  if (binder.constructor.name === "") {
    console.log(state)
  }

  return after - before
}

async function main(): Promise<void> {
  const RESOLVE = 300000
  const RECOMPUTE = 300000
  const BIND = 20000
  const HEAP = 20000

  const resolveAsyncMs = await benchResolve(RESOLVE, binding("v", "Async"))
  const resolveSyncMs = await benchResolve(RESOLVE, binding("v", "Sync"))
  const resolveBareMs = await benchResolve(RESOLVE, { type: "state", value: "v", converters: ["Bare"] })
  const recomputeSyncMs = await benchRecompute(RECOMPUTE, "Sync")
  const bindEdgeMs = await benchBind(BIND, (i) => ({ type: "state", value: `v${i}` }))
  const bindSyncMs = await benchBind(BIND, (i) => binding(`v${i}`, "Sync"))
  const bindAsyncMs = await benchBind(BIND, (i) => binding(`v${i}`, "Async"))
  const heapMb = await benchHeap(HEAP, "Sync")

  const per = (ms: number, n: number): string => `${((ms / n) * 1000).toFixed(3)} µs`
  const rows = [
    ["resolve ASYNC converter (await)", per(resolveAsyncMs, RESOLVE), `${resolveAsyncMs.toFixed(0)} ms`],
    ["resolve SYNC converter (1 arg)", per(resolveSyncMs, RESOLVE), `${resolveSyncMs.toFixed(0)} ms`],
    ["resolve BARE converter (no args)", per(resolveBareMs, RESOLVE), `${resolveBareMs.toFixed(0)} ms`],
    ["recompute SYNC (state→format→write)", per(recomputeSyncMs, RECOMPUTE), `${recomputeSyncMs.toFixed(0)} ms`],
    ["bind: state edge (sync)", per(bindEdgeMs, BIND), `${bindEdgeMs.toFixed(0)} ms`],
    ["bind: sync converter (sync)", per(bindSyncMs, BIND), `${bindSyncMs.toFixed(0)} ms`],
    ["bind: async converter (await)", per(bindAsyncMs, BIND), `${bindAsyncMs.toFixed(0)} ms`],
    ["heap (sync)", `${((heapMb * 1024 * 1024) / HEAP).toFixed(0)} B/binding`, `${heapMb.toFixed(1)} MB`],
  ]

  console.log("\n metric                              | per-unit        | total")
  console.log(" ------------------------------------|-----------------|--------")

  for (const [metric, unit, total] of rows) {
    console.log(` ${metric.padEnd(35)}| ${unit.padEnd(16)}| ${total}`)
  }

  console.log(
    `\nJSON ${JSON.stringify({ resolveAsyncMs, resolveSyncMs, resolveBareMs, recomputeSyncMs, bindEdgeMs, bindSyncMs, bindAsyncMs, heapMb })}`,
  )
}

void main()
