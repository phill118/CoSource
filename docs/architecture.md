# Architecture history and implemented boundaries

This document records the implemented architecture through the purchasing foundation. The permanent product role and current ownership model are defined in [CoSource Resource Resolution Engine](architecture/resource-resolution-engine.md).

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

## Implemented commerce boundary

Pass 2 introduces a provider-independent canonical commerce domain under `src/commerce/domain`, a catalog-provider contract under `src/commerce/providers`, and a Shopify Global Catalog adapter isolated under `src/commerce/providers/shopify-global`. Remote Shopify/UCP JSON is runtime-validated before mapping. Application consumers receive canonical clusters, offers, provenance, messages, and pagination rather than raw transport envelopes.

The provider is environment-neutral and fetch-injectable. A browser CORS preflight against the current Global Catalog endpoint did not succeed, so Pass 3 adds a portable same-origin server gateway. Browser requests reach only `/api/catalog/*`; the gateway injects the existing `CatalogProvider` and never duplicates Shopify transport or mapping logic. A thin localhost Node runner supplies development transport without selecting a deployment vendor.

Server-only configuration and composition live under `server/` and are not imported by the Vite client entry graph. The browser cannot select provider endpoints, tools, headers, or agent profiles. Production deployment adaptation remains a later decision.

Pass 4 adds a browser-owned canonical API client under `src/commerce/client` and a React discovery experience. The client calls only the same-origin gateway and runtime-validates its public success/error envelopes. One application component owns search, cursor pagination, and product-detail state. The UI preserves canonical provenance, availability uncertainty, offer completeness, and currency without importing server or Shopify-provider internals.

Offer emphasis is evidence-based: only an exact canonical `featuredOfferId` match receives the featured label. Money display is centralised in the commerce domain and derives fraction digits from `Intl.NumberFormat` currency metadata rather than assuming two-decimal currencies.

The provider-independent goal domain is owned by the application kernel. Editable `PurchaseGoalDraft`, revision-bound `GoalInterpretationProposal`, and the human-committed validated `PurchaseGoal` are distinct states. Meaningful draft edits advance draft revision; agent proposals remain visible until human rejection or adoption; adoption changes only the draft; and explicit human commitment alone creates active authority. Hard requirements, preferences, exclusions, and exact canonical money remain distinct and runtime-validated. Interpretation is validated input rather than product evidence and never claims that returned products satisfy the goal.

Pass 6 adds one provider-independent evaluator under `src/evaluation`. It accepts only a validated `PurchaseGoal` and canonical `ProductCluster`, plus an evidence-selected offer when available. Exact normalized field names resolve only against canonical attributes, options, and selected offer options. Explicit evidence can prove results; inferred evidence remains visible but unverified. Unknown is first-class. Conservative eligibility accounts for hard requirements, exclusions, and budget evidence, while preferences never invalidate a product. React renders the service output but owns no evaluation rules. No ranking or cross-product comparison exists.

Evaluation resolves competing values by provenance rather than provider-array position: explicit, derived, inferred, then unknown. Conflicts within the strongest applicable tier remain unknown. This resolution is local to evaluation and does not mutate or reorder canonical commerce data.

Pass 7 adds deterministic cross-product comparison and purchase planning under `src/comparison` and `src/planning`. Comparison consumes Pass 6 evaluations and exposes the metrics and reasons behind dominance, tradeoff, equivalence, or insufficient-evidence outcomes. Price is contextual only when both item prices share a currency; it never silently performs foreign exchange or selects a winner.

The purchase plan has stable identity, monotonically increasing revision, and the goal identity and revision it was evaluated against. Each product appears as a distinct plan line with quantity semantics and an optional human-selected offer. Evaluation groups only computable item-price subtotals by currency and separately reports missing offers, unclear quantity multiplication, and stale goal evidence. Shipping, tax, payment, and a universal final total remain merchant-controlled or unresolved.

If a goal includes an overall budget, the plan owns a separate satisfied, failed, or unknown budget result over the complete safely-comparable item subtotal. It never substitutes independent per-product budget results, partially costed lines, mixed currencies, or unsafe aggregate arithmetic. A known plan-budget failure remains a known conflict even when another cost is incomplete; an unknown result prevents ready-on-known-evidence status.

Provider identities are composite values, never bare opaque IDs. A shared structured-key/equality boundary is used by comparison selection, planning, offer resolution, product lookup, and merchant sets. Purchase-plan state changes are exposed as explicit identity-preserving operations rather than generic partial-line patches, preparing a bounded mutation surface for a later WebMCP pass without implementing that pass.

The browser-session owner keeps transient discovery results separate from the retained canonical-product evidence ledger. Only products added to the decision workspace enter this provider-keyed ledger. New search pages reset discovery state without removing retained plan evidence; later canonical search/detail results replace an already-retained object with the same full identity. The ledger's canonical current observations and bounded history are part of the local durable workspace, while discovery and refresh lifecycle remain transient; neither duplicates provider mapping nor affects purchase-plan revision.

Pass 8 adds a browser-only `src/webmcp` adapter. It registers stable read-only imperative tools with `document.modelContext` and obtains current state through a live state reference. Tool handlers call the same evaluation, comparison, and planning services used by React; they do not call providers or duplicate business rules. Registration uses one abort signal for component-lifecycle cleanup, while feature detection leaves unsupported browsers unaffected.

WebMCP output mapping is a trust boundary: canonical session evidence is bounded, external commerce text remains labelled untrusted data, raw provider envelopes and handoff URLs are excluded, and failures are structured without internal exceptions. A session-only activity feed records tool name, timestamp, and concise outcome—not payloads or secrets. Pass 8 exposes no mutation operations.

Pass 9 adds a provider-independent proposal domain under `src/proposals`. The agent-facing `propose_plan_changes` tool may create session proposal state but cannot change the purchase plan, so it is correctly annotated non-read-only. Proposal operations are a closed union mapped to Pass 7 mutation functions; arbitrary patches, URLs, provider configuration, cart, checkout, and payment instructions are rejected.

The human review UI owns approval. It previews operations against a temporary plan with the authoritative evaluator, rechecks plan and goal identities/revisions, revalidates retained product and offer membership, then applies every operation to a temporary copy. Only a fully successful result replaces the single plan state. Human plan or goal edits make pending proposals stale. Session activity distinguishes agent creation, human rejection/approval, CoSource application, stale transitions, and read calls.

Candidate evidence enters the single session registry only through explicit human engagement: opening product detail, selecting a comparison candidate, or adding a product to the plan. Merely rendering a search result does not retain it. A richer detail response replaces evidence only for the same provider-scoped identity and never increments plan revision. This lets WebMCP inspect, evaluate, compare, and propose adding human-selected candidates without granting arbitrary catalogue lookup authority.

Pass 10 adds one provider-independent discovery-strategy compiler and evidence-gap model under `src/sourcing`. Explicit product focus drives the query; supported same-currency price, availability, ships-to, condition, and three documented taxonomy attributes project through the canonical catalog contract. Unsupported requirements and bulk quantity remain visible gaps. WebMCP real-market search uses the same gateway and stores at most ten agent candidates separately from human-retained evidence; inspect or compare is still the promotion boundary.

Backend B1 consolidates browser orchestration under `src/application`. The application session controller is the sole owner of goal, market, sourcing, evidence, comparison selection, plan, proposals, and activity. React and WebMCP are adapters over the same use-cases. See [Application kernel](architecture/application-kernel.md).
