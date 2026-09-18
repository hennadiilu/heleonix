import { Application } from "@heleonix/hx-core"
import { WebApplicationRuntime } from "@heleonix/hx-platform-web"
import { CompiledComponentDefinitionSource } from "hx-compiled-components"
import { CompiledDictionaryDefinitionSource } from "hx-compiled-dictionaries"
import { CompiledConfigDefinitionSource } from "hx-compiled-configs"
import { CompiledStyleDefinitionSource } from "hx-compiled-styles"
import { CompiledThemeDefinitionSource } from "hx-compiled-themes"
import { TruncateConverter } from "./TruncateConverter"
import { SignInAction } from "./SignInAction"
import { SessionService } from "./SessionService"
import dimensions from "../hx.dimensions.json"

export class SandboxApplication extends Application {
  public constructor() {
    super("SandboxApplication", {
      dimensions,
      runtime: WebApplicationRuntime,
      componentDefinition: {
        sources: [CompiledComponentDefinitionSource],
      },
      dictionaryDefinition: {
        sources: [CompiledDictionaryDefinitionSource],
      },
      configDefinition: {
        sources: [CompiledConfigDefinitionSource],
      },
      styleDefinition: {
        sources: [CompiledStyleDefinitionSource],
      },
      themeDefinition: {
        sources: [CompiledThemeDefinitionSource],
      },
      converters: [TruncateConverter],
      actions: [SignInAction],
      services: [SessionService],
    })
  }

  public override async start(): Promise<void> {
    this.dimensions.update({ env: "dev", customer: "customer1", culture: "en-US" })

    await super.start()
  }
}
