import { Action } from "@heleonix/hx-core"
import { SessionService } from "./SessionService"

interface SignInParams {
  /** Name to sign in with (input). */
  readonly user: string
  /** Receives the signed-in user (in-out - must bind a writable state path). */
  signedIn: string
}

/** Signs a user in through the session service. */
export class SignInAction extends Action<SignInParams> {
  public static readonly hxName = "SignIn"

  public Execute(params: SignInParams): Promise<void> {
    const session = this.context.services.get(SessionService)

    session.setUser(params.user)

    params.signedIn = session.getUser()

    return Promise.resolve()
  }
}
