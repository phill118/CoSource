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

## Local workflow

Terminal 1:

```powershell
npm.cmd run dev:api
```

Terminal 2:

```powershell
npm.cmd run dev
```

The native Node runner binds only to `127.0.0.1:8787`. Vite proxies only `/api` to that loopback address. No permissive CORS headers are added.

## Current scope

The gateway provides read-only catalog search, lookup, and product detail. It has no UI, authentication, accounts, persistence, WebMCP, recommendation/ranking, cart, checkout, payment, or deployment adapter.
