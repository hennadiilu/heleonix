import { Injectable } from "./injection/Injectable"

export abstract class FrameworkElement<
  TAllowedInjectable extends Injectable = never,
> extends Injectable<TAllowedInjectable> {}
