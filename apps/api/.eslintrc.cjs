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
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["dist/", "node_modules/", "coverage/"],
  rules: {
    "no-undef": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-constant-condition": "warn",
    "no-extra-semi": "off",
    "no-useless-catch": "warn",
    "no-unsafe-optional-chaining": "warn",
    "prefer-const": "warn",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }
    ]
  },
};
