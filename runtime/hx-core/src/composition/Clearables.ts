import type { IClearable } from "../common/IClearable"

export class Clearables {
  private readonly items: IClearable[] = []

  public get teardownOrder(): readonly IClearable[] {
    return [...this.items].reverse()
  }

  // Teardown is construction order reversed, so a composer registers what it
  // builds at the moment it builds it and never has to state an order.
  public add<TClearable extends IClearable>(item: TClearable): TClearable {
    this.items.push(item)

    return item
  }
}
