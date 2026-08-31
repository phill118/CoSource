# CoSource

Agent-native commerce intelligence.

CoSource is a cross-merchant commerce intelligence and purchasing workspace where humans retain intent and final authority while an AI agent collaborates through structured WebMCP tools.

## Status

This repository contains a human-authored Purchase Goal editor, evidence-aware product evaluation and comparison, a revisioned cross-merchant purchase plan, and real discovery backed by the live Shopify Global Catalog through a provider-independent commerce domain and same-origin gateway. Seven read tools expose current goal, retained evidence, evaluation, comparison, and plan services. A proposal tool lets an agent request only bounded plan operations; a separate read tool reports proposal status. The visible human review area is the sole approval/application path, with stale-revision blocking and atomic application. No WebMCP tool can apply a plan proposal, create checkout, or provide payment.

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

WebMCP requires a currently supported secure Chromium testing environment. Unsupported browsers show an unavailable status while the human interface continues normally. See [WebMCP tools](docs/webmcp/tools.md) and [co-activity boundary](docs/webmcp/coactivity.md).

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
