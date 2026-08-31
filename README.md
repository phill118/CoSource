# CoSource

Agent-native commerce intelligence.

CoSource is intended to become a cross-merchant commerce intelligence and purchasing workspace where humans retain intent and final authority while an AI agent collaborates through structured WebMCP tools.

## Status

This repository contains a human-authored Purchase Goal editor, evidence-aware product evaluation and comparison, a revisioned cross-merchant purchase plan, and real discovery backed by the live Shopify Global Catalog through a provider-independent commerce domain and same-origin gateway. Seven read-only WebMCP tools expose the same current goal, retained canonical evidence, evaluation, comparison, and plan services to supported browser agents. Comparison reports dominance, tradeoffs, equivalent known evidence, or insufficient evidence without a hidden score or automatic recommendation. A browser-session canonical evidence registry keeps real products added to the plan evaluable across later searches. Plans preserve human offer choices and conservative money/unknown semantics.

The project is being prepared for The WebMCP Challenge. Its architectural principle is: humans provide intent and final authority; CoSource supplies trusted application and commerce intelligence; an AI agent plans and collaborates; WebMCP provides the structured browser interface; and authorised commerce providers remain the source of external commerce data.

## Local development

Requires a current stable Node.js release and npm.

```sh
npm install
npm run dev:api
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

Run `dev:api` and `dev` in separate terminals. The API binds to `127.0.0.1:8787`; Vite proxies only `/api` to it. The Shopify-hosted profile is a development fallback. Production requires the server-only `COSOURCE_UCP_AGENT_PROFILE` environment variable.

WebMCP requires a currently supported secure Chromium testing environment. Unsupported browsers show an unavailable status while the human interface continues normally. See [WebMCP tools](docs/webmcp/tools.md).

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
