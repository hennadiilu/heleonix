import type { Converter } from "./Converter"
import type { IConverterContext } from "./IConverterContext"
import type { IConverterProvider } from "./IConverterProvider"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import type { IClearable } from "../common/IClearable"

export class ConverterProvider implements IConverterProvider, IClearable {
  private readonly instances = new Map<string, Converter>()

  public constructor(
    private readonly converterCtors: ReadonlyMap<string, new (context: IConverterContext) => Converter>,
    // A thunk, not the context itself: the context's `dictionaries` provider
    // wraps the evaluator that owns this provider, so it is created after it.
    // Resolved lazily on first `get` (runtime), by when it exists.
    private readonly context: () => IConverterContext,
  ) {}

  public clear(): void {
    this.instances.clear()
  }

  public get(name: string): Converter {
    let instance = this.instances.get(name)

    if (!instance) {
      const ctor = this.converterCtors.get(name)

      if (!ctor) {
        throw new HeleonixError(Errors.unknownConverter, name)
      }

      instance = new ctor(this.context())
      this.instances.set(name, instance)
    }

    return instance
  }
}
