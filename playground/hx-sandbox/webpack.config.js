import path from "node:path"
import { readFileSync } from "node:fs"
import webpack from "webpack"
import HtmlWebpackPlugin from "html-webpack-plugin"
import { HxWebpackPlugin } from "@heleonix/hx-webpack-plugin"

const dimensions = JSON.parse(readFileSync(path.resolve("./hx.dimensions.json"), "utf8"))

export default (env, argv) => {
  const mode = argv.mode === "production" ? "production" : "development"

  return {
    mode,
    entry: "./src/index.ts",
    devtool: "source-map",
    resolve: {
      extensions: [".ts", ".js"],
      alias: {
        "@heleonix/hx-language": path.resolve("../../common/hx-language/src"),
        "@heleonix/hx-utils": path.resolve("../../common/hx-utils/src"),
        "@heleonix/hx-core": path.resolve("../../runtime/hx-core/src"),
        "@heleonix/hx-router": path.resolve("../../runtime/hx-router/src"),
        "@heleonix/hx-ui": path.resolve("../../runtime/hx-ui/src"),
        "@heleonix/hx-platform-web": path.resolve("../../platforms/hx-platform-web/src"),
        "@heleonix/hx-compiler-components": path.resolve("../../compilers/hx-compiler-components/src"),
        "@heleonix/hx-compiler-core": path.resolve("../../compilers/hx-compiler-core/src"),
        "@heleonix/hx-compiler-dictionaries": path.resolve("../../compilers/hx-compiler-dictionaries/src"),
        "@heleonix/hx-compiler-configs": path.resolve("../../compilers/hx-compiler-configs/src"),
        "@heleonix/hx-compiler-constants": path.resolve("../../compilers/hx-compiler-constants/src"),
        "@heleonix/hx-compiler-styles": path.resolve("../../compilers/hx-compiler-styles/src"),
        "@heleonix/hx-compiler-themes": path.resolve("../../compilers/hx-compiler-themes/src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          include: [
            path.resolve("../../common"),
            path.resolve("../../runtime"),
            path.resolve("../../platforms"),
            path.resolve("../../compilers"),
            path.resolve("./src"),
          ],
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        DEV: JSON.stringify(mode === "development"),
      }),
      new HxWebpackPlugin({
        dimensions,
        include: ["./src"],
        declarationFile: "./src/hx-virtual.d.ts",
        emitMeta: true,
        validate: true,
      }),
      new HtmlWebpackPlugin({ template: "./src/index.html" }),
    ],
    devServer: {
      hot: true,
      port: 4000,
      open: process.env.BROWSER !== "none",
      static: false,
      client: {
        overlay: true,
      },
    },
    output: {
      filename: "index.js",
      path: path.resolve(process.cwd(), "dist"),
      clean: false,
      devtoolModuleFilenameTemplate: (info) => {
        const workspaceRoot = path.resolve("../..").replace(/\\/g, "/")
        const absolutePath = info.absoluteResourcePath.replace(/\\/g, "/")
        const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/")
        return `heleonix:///${relativePath}`
      },
    },
  }
}
