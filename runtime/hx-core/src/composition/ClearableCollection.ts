import type { IClearable } from "../common/IClearable"

export class ClearableCollection {
  private readonly items: IClearable[] = []

  public getOrdered(): readonly IClearable[] {
    return [...this.items].reverse()
  }

  public add<TClearable extends IClearable>(item: TClearable): TClearable {
    this.items.push(item)

    return item
  }
}
