import esbuild from "esbuild"

export async function buildNodeBundles({ entryPoints, external = [], watch = false }) {
  /** @type {import("esbuild").BuildOptions} */
  const options = {
    entryPoints,
    outdir: "dist",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    sourcemap: true,
    external,
    logLevel: "info",
  }

  if (watch) {
    const context = await esbuild.context({ ...options, plugins: [watchLogPlugin] })
    await context.watch()
  } else {
    await esbuild.build(options)
  }
}

const watchLogPlugin = {
  name: "watch-log",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"))
    build.onEnd((result) => {
      for (const error of result.errors) console.error(`✘ [ERROR] ${error.text}`)
      console.log("[watch] build finished")
    })
  },
}
