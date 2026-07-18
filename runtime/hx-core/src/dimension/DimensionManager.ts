import { EventEmitter } from "../common/EventEmitter"
import { IEventEmitter } from "../common/IEventEmitter"
import { FrameworkElement } from "../FrameworkElement"
import { IDimension, IDimensionDefinition, stringifyDimension } from "@heleonix/hx-language"
import { IDIContainer } from "../injection/IDIContainer"
import { IDIContainerInternal } from "../injection/IDIContainerInternal"
import { IDimensionManagerSettings } from "./IDimensionManagerSettings"

export class DimensionManager extends FrameworkElement {
  public readonly dimensionDefinitions: readonly IDimensionDefinition[]

  private readonly dimensionChangedEmitter = new EventEmitter<(dimension: IDimension) => void>()

  private _currentDimension: IDimension = {}

  private _dimensionString: string = ""

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    const settings = (diContainer as IDIContainerInternal).getSettings<IDimensionManagerSettings>(
      DimensionManager.diName,
    )

    this.dimensionDefinitions = settings.dimensions ?? []
  }

  public static get diName(): string {
    return "DimensionManager"
  }

  public get currentDimension(): IDimension {
    return this._currentDimension
  }

  public get dimensionString(): string {
    return this._dimensionString
  }

  public get dimensionChanged(): IEventEmitter<(dimension: IDimension) => void> {
    return this.dimensionChangedEmitter
  }

  public updateDimension(diff: IDimension): void {
    this._currentDimension = { ...this._currentDimension, ...diff }

    this._dimensionString = stringifyDimension(this.currentDimension, this.dimensionDefinitions)

    this.dimensionChangedEmitter.emit(this.currentDimension)
  }
}
