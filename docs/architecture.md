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

Pass 6 adds one provider-independent evaluator under `src/evaluation`. It accepts only a validated `PurchaseGoal` and canonical `ProductCluster`, plus an evidence-selected offer when available. Exact normalized field names resolve only against canonical attributes, options, and selected offer options. Explicit evidence can prove results; inferred evidence remains visible but unverified. Unknown is first-class. Conservative eligibility accounts for hard requirements, exclusions, and budget evidence, while preferences never invalidate a product. React renders the service output but owns no evaluation rules. No ranking or cross-product comparison exists.

Evaluation resolves competing values by provenance rather than provider-array position: explicit, derived, inferred, then unknown. Conflicts within the strongest applicable tier remain unknown. This resolution is local to evaluation and does not mutate or reorder canonical commerce data.

Pass 7 adds deterministic cross-product comparison and purchase planning under `src/comparison` and `src/planning`. Comparison consumes Pass 6 evaluations and exposes the metrics and reasons behind dominance, tradeoff, equivalence, or insufficient-evidence outcomes. Price is contextual only when both item prices share a currency; it never silently performs foreign exchange or selects a winner.

The purchase plan has stable identity, monotonically increasing revision, and the goal identity and revision it was evaluated against. Each product appears as a distinct plan line with quantity semantics and an optional human-selected offer. Evaluation groups only computable item-price subtotals by currency and separately reports missing offers, unclear quantity multiplication, and stale goal evidence. Shipping, tax, payment, and a universal final total remain merchant-controlled or unresolved.

If a goal includes an overall budget, the plan owns a separate satisfied, failed, or unknown budget result over the complete safely-comparable item subtotal. It never substitutes independent per-product budget results, partially costed lines, mixed currencies, or unsafe aggregate arithmetic. A known plan-budget failure remains a known conflict even when another cost is incomplete; an unknown result prevents ready-on-known-evidence status.

Provider identities are composite values, never bare opaque IDs. A shared structured-key/equality boundary is used by comparison selection, planning, offer resolution, product lookup, and merchant sets. Purchase-plan state changes are exposed as explicit identity-preserving operations rather than generic partial-line patches, preparing a bounded mutation surface for a later WebMCP pass without implementing that pass.

The browser-session owner keeps discovery results separate from a small retained canonical-product evidence registry. Only products added to the decision workspace enter this provider-keyed registry. New search pages reset discovery and comparison state without removing retained plan evidence; later canonical search/detail results replace an already-retained object with the same full identity. This operational cache is not persistence, does not duplicate provider mapping, and does not affect purchase-plan revision.

Pass 8 adds a browser-only `src/webmcp` adapter. It registers stable read-only imperative tools with `document.modelContext` and obtains current state through a live state reference. Tool handlers call the same evaluation, comparison, and planning services used by React; they do not call providers or duplicate business rules. Registration uses one abort signal for component-lifecycle cleanup, while feature detection leaves unsupported browsers unaffected.

WebMCP output mapping is a trust boundary: canonical session evidence is bounded, external commerce text remains labelled untrusted data, raw provider envelopes and handoff URLs are excluded, and failures are structured without internal exceptions. A session-only activity feed records tool name, timestamp, and concise outcome—not payloads or secrets. Pass 8 exposes no mutation operations.
