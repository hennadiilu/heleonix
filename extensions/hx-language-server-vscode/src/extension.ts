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

const CONFIG_FILES = ["hx.config.json", "hx.dimensions.json"]

const LANGUAGES = [
  "heleonix-hx-component",
  "heleonix-hx-dictionary",
  "heleonix-hx-config",
  "heleonix-hx-style",
  "heleonix-hx-theme",
]

export async function activate(context: ExtensionContext): Promise<void> {
  client = createClient(context)
  await client.start()

  // Restart so the server picks up changed settings (exclude list, diagnostics
  // toggle), or a newly granted workspace trust (which enables custom transport modules).
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
    // The configuration documents too, so the server reads their unsaved edits.
    documentSelector: [
      ...LANGUAGES.map((language) => ({ scheme: "file", language })),
      ...CONFIG_FILES.map((name) => ({ scheme: "file", pattern: `**/${name}` })),
    ],
    // The server's options contract (see the language server's README), from the
    // `heleonix.hx.*` settings.
    initializationOptions: {
      exclude: config.get<string[]>("exclude", []),
      diagnostics: {
        enable: config.get<boolean>("diagnostics.enable", true),
        severity: config.get<Record<string, string>>("diagnostics.severity", {}),
      },
      definitionSources: config.get<string[]>("definitionSources", []),
      typescript: {
        projects: config.get<string[]>("typescript.projects"),
        exclude: config.get<string[]>("typescript.exclude"),
        linkedPackages: config.get<boolean>("typescript.linkedPackages", false),
      },
      // Custom transport modules execute workspace code, so the server only loads
      // them when the workspace is trusted (see onDidGrantWorkspaceTrust below).
      workspaceTrusted: workspace.isTrusted,
    },
    // The server registers its own watcher for hx* files; no client-side
    // synchronize.fileEvents here, to avoid duplicate change notifications.
  }

  return new LanguageClient("heleonix.hx", "Heleonix Framework Language Server", serverOptions, clientOptions)
}
