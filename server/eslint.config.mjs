import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce explicit return types on exported functions
      "@typescript-eslint/explicit-module-boundary-types": "error",
      // No explicit any
      "@typescript-eslint/no-explicit-any": "error",
      // Require await in async functions
      "@typescript-eslint/require-await": "error",
      // Prefer nullish coalescing
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
    },
  },
  {
    // Relax rules for test files
    files: ["src/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/"],
  }
);
