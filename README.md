# CoSource

Agent-native commerce intelligence.

CoSource is a cross-merchant commerce intelligence and purchasing workspace where humans retain intent and final authority while an AI agent collaborates through structured WebMCP tools.

## Status

This repository contains a human-authored goal draft, visible agent interpretation proposals, explicit human goal commitment, deterministic constraint-driven sourcing, evidence-aware evaluation and comparison, a revisioned cross-merchant purchase plan, and real Shopify Global Catalog discovery through a provider-independent domain and same-origin gateway. Thirteen WebMCP tools expose current intelligence, bounded interpretation and plan proposals, real-market search, and evidence gaps. Agents cannot activate goals or apply plan changes. No WebMCP tool can create checkout or provide payment.

The project is being prepared for The WebMCP Challenge. Its architectural principle is: humans provide intent and final authority; CoSource supplies trusted application and commerce intelligence; an AI agent plans and collaborates; WebMCP provides the structured browser interface; and authorised commerce providers remain the source of external commerce data.

Browser orchestration is owned by a provider-independent application kernel. React and WebMCP share its sourcing, evidence, evaluation, comparison, planning, and proposal use-cases; neither adapter owns parallel business workflows.

## Local development

Requires Node.js `>=22.12.0 <23` and npm. A clean install must retain development dependencies because TypeScript, Vite, ESLint, and Vitest are build and validation tools.

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

## Production runtime

`npm run build` creates the browser bundle in `dist` and the native Node server bundle in `dist-server`. Start the single production service with:

```sh
npm start
```

The service serves the SPA, `/health`, and the same-origin `/api/catalog/*` gateway from one origin. Hosting platforms supply `PORT`; production binds to `0.0.0.0`. Set `NODE_ENV=production` and an HTTPS `COSOURCE_UCP_AGENT_PROFILE` in the server environment. Do not expose this configuration through `VITE_` variables or browser requests.

`render.yaml` provides a portable Render deployment definition pinned to the supported Node 22 range. Its build command is `npm ci --include=dev && npm run build`; the explicit npm option keeps the required build toolchain available even when the hosting environment sets production mode. Connect the repository, provide `COSOURCE_UCP_AGENT_PROFILE` in the service environment, deploy, and verify `/health` before opening the application. Other Node hosts can use the same clean-install, build, and start commands.

For challenge review, open the deployed HTTPS URL in a secure Chromium environment with WebMCP support. The human interface remains usable when WebMCP is unavailable. Goal, evaluation, comparison, plan, and proposal state is intentionally memory-only and resets when the service or page session ends. CoSource remains read-only commerce intelligence: it does not perform cart, checkout, payment, or purchase execution.

WebMCP requires a currently supported secure Chromium testing environment. Unsupported browsers show an unavailable status while the human interface continues normally. See [WebMCP tools](docs/webmcp/tools.md) and [co-activity boundary](docs/webmcp/coactivity.md).

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
