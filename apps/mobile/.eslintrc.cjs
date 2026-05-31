module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["android/", "ios/", "node_modules/", "coverage/"],
  rules: {
    "no-undef": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-extra-boolean-cast": "warn",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }
    ],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
};
