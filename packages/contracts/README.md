# API Contracts

This package is the TypeScript source of truth for data exchanged between the
API, mobile app, and web app. Keep transport-facing fields here and import them
with `import type` from `@fitnes-saas/contracts`.

The current Express API does not maintain an OpenAPI document, so the first
contract layer is intentionally a shared TypeScript package. If the API later
adopts OpenAPI, generated types can replace these source files behind the same
package name without changing every consumer import.

Run `pnpm --filter @fitnes-saas/contracts typecheck` after changing a contract.
Workspace `typecheck` also validates API serializers and client consumers
against the package.
