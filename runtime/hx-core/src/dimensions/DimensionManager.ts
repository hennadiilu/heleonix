import { EventEmitter } from "../common/EventEmitter"
import { IEventEmitter } from "../common/IEventEmitter"
import { IDimension, IDimensionDefinition, stringifyDimension } from "@heleonix/hx-language"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import type { IDimensionManager } from "./IDimensionManager"

export class DimensionManager implements IDimensionManager {
  public readonly definitions: readonly IDimensionDefinition[]

  private readonly changedEmitter = new EventEmitter<(dimension: IDimension) => void>()

  private _current: IDimension = {}

  private _currentKey: string

  public constructor(definitions: readonly IDimensionDefinition[]) {
    this.definitions = definitions

    this._currentKey = stringifyDimension(this._current, definitions)
  }

  public get current(): IDimension {
    return this._current
  }

  public get currentKey(): string {
    return this._currentKey
  }

  public get changed(): IEventEmitter<(dimension: IDimension) => void> {
    return this.changedEmitter
  }

  public update(diff: IDimension): void {
    this.validate(diff)

    if (!this.hasChanges(diff)) {
      return
    }

    this._current = { ...this._current, ...diff }

    this._currentKey = stringifyDimension(this.current, this.definitions)

    this.changedEmitter.emit(this.current)
  }

  private validate(diff: IDimension): void {
    for (const name of Object.keys(diff)) {
      const definition = this.definitions.find((candidate) => candidate.name === name)

      if (!definition) {
        throw new HeleonixError(
          Errors.unknownDimension,
          name,
          this.definitions.map((candidate) => candidate.name).join(", "),
        )
      }

      if (!definition.values.includes(diff[name])) {
        throw new HeleonixError(Errors.invalidDimensionValue, diff[name], name, definition.values.join(", "))
      }
    }
  }

  private hasChanges(diff: IDimension): boolean {
    return Object.keys(diff).some((name) => this._current[name] !== diff[name])
  }
}
