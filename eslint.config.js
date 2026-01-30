const tseslint = require("typescript-eslint");
const playwright = require("eslint-plugin-playwright");

module.exports = [
  {
    ignores: [
      "node_modules/",
      "playwright-report/",
      "test-results/",
      "*.mjs",
      "eslint.config.js",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    files: ["tests/**/*.spec.ts"],
    ...playwright.configs["flat/recommended"],
  },
];
