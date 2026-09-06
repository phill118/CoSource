# CoSource

Evidence-governed resource resolution.

The **CoSource Engine** is a shared, potentially standalone Resource Resolution Engine: it turns a defined external resource requirement into verified candidates and viable plans without taking ownership of the decision that created the requirement. **CoSource Purchasing** is the current commerce-focused product surface powered by that engine.

## Status

This repository currently implements the purchasing surface: a human-authored goal draft, visible agent interpretation proposals, explicit human goal commitment, a canonical Resource Requirement projection, deterministic constraint-driven sourcing, evidence-aware evaluation and comparison, a revisioned cross-merchant purchase plan, and real Shopify Global Catalog discovery through a provider-independent domain and same-origin gateway. Shopify Global Catalog is the only live provider. State is memory-only.

Thirteen WebMCP tools provide one bounded agent surface for current intelligence, proposals, real-market search, and evidence gaps. WebMCP does not define the product and is not its only possible future intelligence interface. Agents cannot activate goals or apply plan changes. No tool can create checkout, provide payment, or place a purchase order.

Browser orchestration is owned by a provider-independent application kernel. React and WebMCP share its sourcing, evidence, evaluation, comparison, planning, and proposal use-cases; neither adapter owns parallel business workflows.

Broader resource classes, persistent requirements, monitoring, resolution repair, additional providers, and CORAP integrations are not implemented. CORAP's Presence, Affiliate, Commerce, and Renderer operating systems may later call CoSource through purpose-limited contracts; CoSource is not a fifth OS and is not owned by Commerce OS. Commerce remains authoritative for supplier relationships, purchasing, inventory, and financial consequences. See [Resource Resolution Engine](docs/architecture/resource-resolution-engine.md).

Retained product evidence is held in one bounded, memory-only [canonical evidence ledger](docs/architecture/evidence-ledger.md). It records when CoSource accepted observations, preserves five superseded observations per product, and drives shared freshness, conflict, gap, and qualitative decision-readiness results without inventing confidence scores.

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

For native WebMCP review, open the deployed HTTPS URL in a secure Chromium environment with WebMCP support. The human interface remains usable when WebMCP is unavailable. Goal, requirement projection, evaluation, comparison, plan, and proposal state is intentionally memory-only and resets when the service or page session ends. CoSource Purchasing does not perform cart, checkout, payment, or purchase execution.

WebMCP requires a currently supported secure Chromium testing environment. Unsupported browsers show an unavailable status while the human interface continues normally. See [WebMCP tools](docs/webmcp/tools.md) and [co-activity boundary](docs/webmcp/coactivity.md).

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
