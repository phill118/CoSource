# Cloudflare Workers deployment

CoSource can run on the Cloudflare Workers Free plan without KV, D1, R2, Durable Objects, paid bindings, or stored secrets. `wrangler.jsonc` uses compatibility date `2026-09-15`, runs the Worker before assets, and binds the compiled `dist` directory as `ASSETS` with single-page-application fallback.

The additive Worker adapter preserves the Node and Render runtime. It reuses the canonical catalog gateway, Shopify Global Catalog provider, schemas, and catalog-only UCP profile. The incoming HTTPS request origin determines the public `/.well-known/ucp` URL supplied to Shopify. No origin, endpoint, credential, or Cloudflare configuration enters the browser bundle.

Build and validate locally:

```powershell
npm.cmd run build
npm.cmd run cloudflare:check
npm.cmd run cloudflare:dev -- --local --port 9245
```

The Worker owns `/health`, `/.well-known/ucp`, and `/api/*` before SPA fallback. All other requests pass to the static asset binding. The same strict CSP and browser security headers apply to Worker, JSON, HTML, and asset responses.

The public profile advertises only UCP `2026-04-08` catalog search, catalog lookup, and the minimum Shopify Global Catalog extension, with empty payment handlers. CoSource does not advertise or perform cart, checkout, payment, ordering, booking, subscription, licence acceptance, purchasing, or supplier communication.

Deployment must remain on the Workers Free plan. Stop if Cloudflare requests billing details or a paid resource. Do not add KV, D1, R2, Durable Objects, or other bindings for this adapter.
