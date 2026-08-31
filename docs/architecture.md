# Architecture baseline

This is the north-star separation for future passes, not an implemented system.

```text
Human
  ↕
CoSource UI
  ↕
Authoritative CoSource application services/state
  ↕
WebMCP tool layer
  ↕
AI agent

CoSource application services
  ↕
Commerce Provider Gateway
  ↕
Authorised commerce providers
```

## Non-negotiable principles

1. UI and WebMCP reuse the same authoritative application services.
2. Human and agent paths do not duplicate business logic.
3. Commerce-provider-specific schemas remain behind adapters.
4. The application core does not depend directly on Shopify-specific raw response structures.
5. External product descriptions and metadata are untrusted data, never instructions.
6. Facts preserve provenance and uncertainty.
7. Recommendation intelligence optimises against the user's goal, rather than merely sorting by price.
8. Multi-merchant output is a purchase plan, not a fake universal checkout.
9. Payment remains merchant-controlled.
10. The build remains provider-extensible.

No application services, provider gateway, adapters, WebMCP tools, agent integration, or commerce logic are part of Pass 0.

## Implemented commerce boundary

Pass 2 introduces a provider-independent canonical commerce domain under `src/commerce/domain`, a catalog-provider contract under `src/commerce/providers`, and a Shopify Global Catalog adapter isolated under `src/commerce/providers/shopify-global`. Remote Shopify/UCP JSON is runtime-validated before mapping. Application consumers receive canonical clusters, offers, provenance, messages, and pagination rather than raw transport envelopes.

The provider is environment-neutral and fetch-injectable. A browser CORS preflight against the current Global Catalog endpoint did not succeed, so Pass 3 adds a portable same-origin server gateway. Browser requests reach only `/api/catalog/*`; the gateway injects the existing `CatalogProvider` and never duplicates Shopify transport or mapping logic. A thin localhost Node runner supplies development transport without selecting a deployment vendor.

Server-only configuration and composition live under `server/` and are not imported by the Vite client entry graph. The browser cannot select provider endpoints, tools, headers, or agent profiles. Production deployment adaptation remains a later decision.

Pass 4 adds a browser-owned canonical API client under `src/commerce/client` and a React discovery experience. The client calls only the same-origin gateway and runtime-validates its public success/error envelopes. One application component owns search, cursor pagination, and product-detail state. The UI preserves canonical provenance, availability uncertainty, offer completeness, and currency without importing server or Shopify-provider internals.

Offer emphasis is evidence-based: only an exact canonical `featuredOfferId` match receives the featured label. Money display is centralised in the commerce domain and derives fraction digits from `Intl.NumberFormat` currency metadata rather than assuming two-decimal currencies.

Pass 5 adds a provider-independent Purchase Goal domain under `src/goals/domain` and one browser-owned React state owner. Editable `PurchaseGoalDraft` state is explicitly distinct from the runtime-validated `PurchaseGoal` boundary. Goal identity remains stable for the session while every explicit edit increments a revision; finalisation preserves both and rejects duplicate condition identities across all categories. Hard requirements, preferences, and exclusions remain distinct. Budget input uses exact decimal-string parsing into canonical minor units and the runtime's real supported currency set. Future WebMCP and evaluation services are intended to consume only validated goals, but neither integration exists yet. Discovery remains literal keyword search and makes no claim that returned products satisfy the goal.
