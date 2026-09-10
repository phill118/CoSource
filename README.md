# CoSource

Evidence-governed resource resolution.

The **CoSource Engine** is a shared, potentially standalone Resource Resolution Engine: it turns a defined external resource requirement into verified candidates and viable plans without taking ownership of the decision that created the requirement. **CoSource Purchasing** is the current commerce-focused product surface powered by that engine.

## Status

This repository currently implements the purchasing surface: a human-authored goal draft, visible agent interpretation proposals, explicit human goal commitment, a canonical Resource Requirement projection, deterministic constraint-driven sourcing, evidence-aware evaluation and comparison, a revisioned cross-merchant purchase plan, and real Shopify Global Catalog discovery through a provider-independent domain and same-origin gateway. Shopify Global Catalog is the only live provider. Durable workspace decision state is persisted locally in browser IndexedDB; discovery and execution state remains transient.

Thirteen WebMCP tools provide one bounded agent surface for current intelligence, proposals, real-market search, and evidence gaps. WebMCP does not define the product and is not its only possible future intelligence interface. Agents cannot activate goals or apply plan changes. No tool can create checkout, provide payment, or place a purchase order.

All discovery now crosses one capability-aware sourcing boundary. Registered sources declare strict factual capabilities; CoSource selects only permitted resource-compatible sources, preserves unsupported intent as explicit gaps, and binds continuation to its source and originating requirement context. The current live source remains the existing Shopify Global Catalog adapter, while deterministic test fixtures prove that the contracts also represent materials, services, software subscriptions, and licensed assets without product-specific kernel branches. See [Universal sourcing](docs/architecture/universal-sourcing.md).

Plan costing now uses one [canonical landed-cost engine](docs/architecture/canonical-costing.md). Listing prices, additions, discounts, unknown categories, currencies, recurring charges and supplier-order scope remain distinct; an overall budget is satisfied only by complete exact same-currency one-time cost evidence.

Up to 50 named purchasing projects can be saved in local browser storage. One application-level portfolio controller owns their strict metadata, active selection, creation, rename, and safe switching; the active application kernel remains the sole owner of all purchasing state. Without IndexedDB, CoSource remains usable as one honestly labelled memory-only workspace.

Browser orchestration is owned by a provider-independent application kernel. React and WebMCP share its sourcing, evidence, evaluation, comparison, planning, and proposal use-cases; neither adapter owns parallel business workflows.

Broader resource classes, persistent requirements, monitoring, resolution repair, additional providers, and CORAP integrations are not implemented. CORAP's Presence, Affiliate, Commerce, and Renderer operating systems may later call CoSource through purpose-limited contracts; CoSource is not a fifth OS and is not owned by Commerce OS. Commerce remains authoritative for supplier relationships, purchasing, inventory, and financial consequences. See [Resource Resolution Engine](docs/architecture/resource-resolution-engine.md).

Retained product evidence is held in one bounded [canonical evidence ledger](docs/architecture/evidence-ledger.md). Its current observations and five-entry histories are part of the local durable workspace; refresh requests and their loading/error authority remain transient. The ledger drives shared freshness, conflict, gap, and qualitative decision-readiness results without inventing confidence scores.

Meaningful workspace decision state survives reload in a strict versioned IndexedDB record through a replaceable application [persistence port](docs/architecture/local-workspace-persistence.md). This is local to the browser profile: there are no accounts, tenant sync, cloud backup, or cross-device guarantees.

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

For native WebMCP review, open the deployed HTTPS URL in a secure Chromium environment with WebMCP support. The human interface remains usable when WebMCP is unavailable. Goal draft and commitment, retained evidence, comparison identities, plan, proposals, bounded activity, market, and workspace identity survive reload through local IndexedDB when storage is healthy. Discovery results, request and refresh lifecycle, React presentation, WebMCP registration, network objects, and promises reset. CoSource Purchasing does not perform cart, checkout, payment, or purchase execution.

WebMCP requires a currently supported secure Chromium testing environment. Unsupported browsers show an unavailable status while the human interface continues normally. See [WebMCP tools](docs/webmcp/tools.md) and [co-activity boundary](docs/webmcp/coactivity.md).

## Technology

React, TypeScript, Vite, ESLint, and Vitest.

## Licence

Licensed under the [MIT License](LICENSE).
