import * as path from "node:path"
import { commands, ExtensionContext, workspace } from "vscode"
import {
  ExecuteCommandRequest,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node"

let client: LanguageClient | undefined

const RELOAD_COMMAND = "heleonix.reloadDefinitions"

const LANGUAGES = ["heleonix-hx-component", "heleonix-hx-dictionary", "heleonix-hx-config"]

export async function activate(context: ExtensionContext): Promise<void> {
  client = createClient(context)
  await client.start()

  // Restart so the server picks up changed settings (exclude list, diagnostics
  // toggle), or a newly granted workspace trust (which enables custom loader modules).
  const restart = async (): Promise<void> => {
    await client?.stop()
    client = createClient(context)
    await client.start()
  }

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration("heleonix.hx")) {
        await restart()
      }
    }),
    workspace.onDidGrantWorkspaceTrust(() => void restart()),
    // Forward the "Reload Definitions" command to the server, which re-pulls
    // every external definition source (packages, endpoints, manifests).
    commands.registerCommand(RELOAD_COMMAND, () =>
      client?.sendRequest(ExecuteCommandRequest.type, { command: RELOAD_COMMAND }),
    ),
  )
}

export async function deactivate(): Promise<void> {
  await client?.stop()
  client = undefined
}

function createClient(context: ExtensionContext): LanguageClient {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"))

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  }

  const config = workspace.getConfiguration("heleonix.hx")

  const clientOptions: LanguageClientOptions = {
    documentSelector: LANGUAGES.map((language) => ({ scheme: "file", language })),
    initializationOptions: {
      exclude: config.get<string[]>("exclude", []),
      diagnostics: config.get<boolean>("diagnostics.enable", true),
      unknownReferenceSeverity: config.get<string>("diagnostics.unknownReferenceSeverity", "warning"),
      unusedEntrySeverity: config.get<string>("diagnostics.unusedEntrySeverity", "information"),
      definitionSources: config.get<string[]>("definitionSources", []),
      // Custom loader modules execute workspace code, so the server only loads
      // them when the workspace is trusted (see onDidGrantWorkspaceTrust below).
      workspaceTrusted: workspace.isTrusted,
    },
    // The server registers its own watcher for hx* files; no client-side
    // synchronize.fileEvents here, to avoid duplicate change notifications.
  }

  return new LanguageClient("heleonix.hx", "Heleonix Framework Language Server", serverOptions, clientOptions)
}
