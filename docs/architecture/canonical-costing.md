# Canonical cost and landed-cost engine

CoSource owns one provider-independent cost engine under `src/costing`. It consumes bounded canonical components and neutral integer-minor-unit `Money`; it does not depend on Shopify, React, WebMCP, purchase goals, or product clusters. Commerce and planning adapters translate selected offers and plan lines into this boundary. `evaluatePurchasePlan` remains the sole authoritative plan evaluator and invokes the engine once.

Components distinguish base/listing price, delivery, tax, import duty, mandatory fees, discounts and explicitly labelled other costs. Addition or deduction is separate from the non-negative amount. Per-unit, per-line, supplier-order, whole-plan, recurring and unresolved usage bases are explicit, as are applicability, exact/ranged/unknown knowledge, one-time/recurring/usage timing, and bounded evidence strength. Safe-integer arithmetic uses integer minor units, rejects overflow and cross-currency ranges, never performs FX, and rejects deductions that exceed payable additions. Identical order-scoped claims for one stable merchant scope are counted once; conflicts are surfaced rather than selected by input order. Unknown merchant grouping is not guessed.

The assessment reports listing subtotal, known additions and deductions, landed-cost lower bound, a supported upper bound, and an exact landed total only when every applicable mandatory one-time cost is exact. Currencies remain separate. Recurring and usage-based amounts remain outside the one-time landed total without a bounded horizon. Unknown applicability, missing categories, conflicts and human-verification reasons are first-class output rather than zeros or confidence percentages.

`maximumItemPrice` remains a base/listing unit-price ceiling. The overall goal `budget` applies to the complete one-time landed plan cost. A complete exact same-currency landed cost can satisfy or fail the budget; a known lower bound already over budget fails even when other costs are unknown. Otherwise incomplete, ranged, conflicting, recurring, usage-based or mixed-currency evidence leaves the budget unknown.

`MerchantOffer.price` remains the exact provider-returned listing price. Optional canonical cost components and an explicit complete one-time coverage marker are backward-compatible additions to retained evidence; workspace format remains version 1. Current Shopify responses do not establish complete delivery, tax, duty, fees, discounts or final payable cost, so their landed total and budget satisfaction remain unproven. CoSource does not scrape checkout or call cart, payment, ordering, tax, shipping-rate or FX services. The merchant handoff is the final verification point.

Future tax or delivery quote sources may provide bounded components through the same adapter boundary. Estimation, FX, optimisation, monitoring and fulfilment execution are not implemented.

## Coverage and scoped claims

Coverage is explicit evidence, not an inference from omitted fields. A complete assertion carries bounded provenance; partial coverage names only categories or reasons the source can actually establish as unresolved. The neutral engine does not impose retail delivery, duty, tax, or fee categories on every resource kind. Shopify continues to assert listing price only unless a validated response explicitly proves additional evidence.

Cost certainty follows explicit evidence precedence. `source_explicit` and `cosource_derived` are decision-grade; derived evidence remains labelled as derived. `source_inferred` and `unknown` are verification-only. Verification-only coverage or amounts remain visible unresolved evidence, cannot establish an exact landed total, cannot satisfy a budget, and cannot create a lower-bound failure. No percentage confidence is inferred.

Scoped claim identity combines the evidence source identity, the supplier/order scope (for `per_order`) or canonical plan scope (for `per_plan`), the claim identifier, and category. Identical claims at that identity count once. Incompatible claims conflict before arithmetic and contribute no arbitrarily selected exact amount. A source-local order identifier therefore cannot collide with the same local identifier from another source.

Semantically identical scoped claims use deterministic representative precedence: stronger evidence first (`source_explicit`, `cosource_derived`, `source_inferred`, then `unknown`), then the latest represented `observedAt`, then a stable canonical-data tie-breaker. Evidence metadata differences alone do not create a claim conflict; incompatible cost semantics still do.

Timestamp precedence compares the represented ISO instants, not their textual offsets. Equal instants retain their original timestamp text and use canonical-data ordering only as a deterministic tie-breaker.

Claim identity covers every basis. Per-unit, per-line, recurring and usage claims are scoped to their owning line; per-order claims use source plus supplier/order scope; per-plan claims use source plus the current assessment. Source, component ID and category remain part of every identity. Duplicate neutral line IDs are rejected before grouping. Identical claims count once, while incompatible claims at one identity conflict before arithmetic.

Safe aggregation maintains independent accumulators for the base subtotal, addition minimum and maximum, and deduction minimum and maximum. Overflow in one projection cannot roll back evidence already established by another: for example, an unsupported addition maximum leaves its safe minimum and exact base visible, while an unsupported deduction maximum invalidates the payable lower bound. A safe deduction minimum can still support an upper-bound projection. Affected components remain explicit unresolved evidence and any overflow prevents an exact assessment. This is not clamping: no unsafe or partial amount is emitted or relabelled as exact.

Every non-empty plan line enters assessment. Missing product or offer evidence and unresolved quantity semantics become explicit partial-coverage lines, ensuring plan completeness, readiness, budget, React, and WebMCP share the same canonical result.
