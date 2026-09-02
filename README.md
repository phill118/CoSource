# CoSource

Agent-native commerce intelligence.

CoSource is a cross-merchant commerce intelligence and purchasing workspace where humans retain intent and final authority while an AI agent collaborates through structured WebMCP tools.

## Status

This repository contains a human-authored goal draft, visible agent interpretation proposals, explicit human goal commitment, deterministic constraint-driven sourcing, evidence-aware evaluation and comparison, a revisioned cross-merchant purchase plan, and real Shopify Global Catalog discovery through a provider-independent domain and same-origin gateway. Thirteen WebMCP tools expose current intelligence, bounded interpretation and plan proposals, real-market search, and evidence gaps. Agents cannot activate goals or apply plan changes. No WebMCP tool can create checkout or provide payment.

The project is being prepared for The WebMCP Challenge. Its architectural principle is: humans provide intent and final authority; CoSource supplies trusted application and commerce intelligence; an AI agent plans and collaborates; WebMCP provides the structured browser interface; and authorised commerce providers remain the source of external commerce data.

Browser orchestration is owned by a provider-independent application kernel. React and WebMCP share its sourcing, evidence, evaluation, comparison, planning, and proposal use-cases; neither adapter owns parallel business workflows.

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

WebMCP requires a currently supported secure Chromium testing environment. Unsupported browsers show an unavailable status while the human interface continues normally. See [WebMCP tools](docs/webmcp/tools.md) and [co-activity boundary](docs/webmcp/coactivity.md).

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
