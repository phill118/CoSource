# Server-side commerce gateway

The Shopify Global Catalog endpoint did not satisfy the browser CORS preflight tested in Pass 2. CoSource therefore uses this same-origin path:

```text
Browser → /api/catalog/* → canonical gateway → CatalogProvider → ShopifyGlobalCatalogProvider
```

The gateway is a transport and security boundary, not a second commerce implementation. It returns canonical CoSource data and delegates all provider transport, response validation, provenance, and mapping to the Pass 2 provider.

## Browser routes

All routes require `POST` and `Content-Type: application/json`:

- `/api/catalog/search`: canonical query, localization, bounded pagination, availability, ships-to, and currency-attached maximum price.
- `/api/catalog/lookup`: 1–50 canonical Shopify product/variant identifiers; arbitrary URLs are not accepted.
- `/api/catalog/product`: product UPID, bounded selected options, preference order, and localization.

Success uses `{ "ok": true, "data": ... }`. Failure uses a safe `{ "ok": false, "error": { "code", "message" } }` envelope. Upstream payloads, stack traces, configuration, and validation details are not returned.

Request bodies are limited to 32 KiB. Schemas reject unknown fields, so clients cannot supply a target URL, endpoint, profile, headers, method, provider, Shopify tool, or JSON-RPC request. The only outbound destination remains the fixed endpoint owned by `ShopifyGlobalCatalogProvider`.

## Server configuration

`server/commerce/provider-factory.ts` is the one composition point. The agent profile is read from server configuration and never from a browser request or `VITE_` variable.

For local development only, configuration falls back to Shopify's live-verified public test profile. Production requires an HTTPS `COSOURCE_UCP_AGENT_PROFILE`. The profile is public metadata; the security boundary is configuration control, not secrecy.

## Local and production workflow

Terminal 1:

```powershell
npm.cmd run dev:api
```

Terminal 2:

```powershell
npm.cmd run dev
```

The development Node runner binds only to `127.0.0.1:8787`. Vite proxies only `/api` to that loopback address. No permissive CORS headers are added.

For production, `npm run build` emits the browser client to `dist` and a bundled native Node entry point to `dist-server`. `npm start` serves static assets, extensionless SPA fallbacks, `/health`, and the existing gateway from one process and origin. It uses the hosting platform's `PORT` and binds to `0.0.0.0`; `COSOURCE_API_PORT` remains a development-compatible fallback. Startup fails clearly if the client build or required production agent profile is missing.

Static responses include a restrictive same-origin content security policy and common browser hardening headers. HTML and API responses are not cached; fingerprinted `/assets` files receive immutable caching. `/api` paths never fall through to the SPA, request bodies remain limited to 32 KiB, and unexpected failures return a generic error without filesystem, stack, provider, or configuration detail.

`render.yaml` supplies a Render web-service definition using Node.js `>=22.12.0 <23`, `npm ci --include=dev && npm run build`, `npm start`, and `/health`. The clean install explicitly retains the development-classified TypeScript and Vite build toolchain. The required HTTPS `COSOURCE_UCP_AGENT_PROFILE` is supplied only as server environment configuration. No provider configuration or credential is compiled into the browser bundle.

## Current scope

The gateway provides read-only catalog search, lookup, and product detail. The production server also hosts the existing UI and WebMCP-capable browser application, but it adds no authentication, accounts, server persistence, cart, checkout, payment, or purchase execution. Durable workspace state is stored only by the browser's local IndexedDB adapter; the server never receives or owns that record.
