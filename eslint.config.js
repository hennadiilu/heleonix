import eslint from "@eslint/js"
import { defineConfig } from "eslint/config"
import prettierConfig from "eslint-config-prettier"
import tseslint from "typescript-eslint"

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/member-ordering": "error",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  prettierConfig,
)
