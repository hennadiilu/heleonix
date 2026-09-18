import { Service } from "@heleonix/hx-core"

/** Keeps who is using the sandbox for the run of the application. */
export class SessionService extends Service {
  private user = "guest"

  public getUser(): string {
    return this.user
  }

  public setUser(user: string): void {
    this.user = user
  }
}
