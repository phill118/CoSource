# CoSource

Agent-native commerce intelligence.

CoSource is intended to become a cross-merchant commerce intelligence and purchasing workspace where humans retain intent and final authority while an AI agent collaborates through structured WebMCP tools.

## Status

This repository contains a human-authored Purchase Goal editor, evidence-aware product evaluation and comparison, a revisioned cross-merchant purchase plan, and real discovery backed by the live Shopify Global Catalog through a provider-independent commerce domain and same-origin gateway. Comparison reports dominance, tradeoffs, equivalent known evidence, or insufficient evidence from explicit evaluation outcomes; it does not calculate a hidden score or automatically recommend a winner. A browser-session canonical evidence registry keeps real products added to the plan evaluable across later searches. Plans keep human offer choices, safely group known item-price subtotals by currency, enforce an overall goal budget only when the full comparable subtotal is known, and leave shipping, tax, ambiguous quantities, mixed currencies, and missing offers unresolved.

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

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
