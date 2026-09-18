import type { Component } from "../components/Component"

export interface IStyleScopeResolver {
  resolve(component: Component, path: string): readonly Component[]
}
