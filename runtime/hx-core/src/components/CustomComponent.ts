import { Component } from "./Component"
import type { DataObject } from "../common/DataObject"

export abstract class CustomComponent<
  TProps extends DataObject<TProps> = object,
  TEvents extends DataObject<TEvents> = object,
> extends Component<TProps, TEvents> {}
