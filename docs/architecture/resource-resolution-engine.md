# CoSource Resource Resolution Engine

## Permanent role

The CoSource Engine is an evidence-governed Resource Resolution Engine. It accepts a bounded external resource requirement, supports verification of candidates, and can produce alternative plans and repairable resolutions. It does not own the business decision that created the requirement or the consequential decision to execute a resolution.

CoSource is not a CORAP operating system and is not a subsystem of Commerce OS. CORAP contains Presence OS, Affiliate OS, Commerce OS, and Renderer OS. Those systems may later request resource-resolution work through purpose-limited contracts while retaining their own strategy and authority. CoSource can also operate as a standalone product.

## Current implemented slice

CoSource Purchasing is the current standalone surface. Its authoritative human intent is a committed `PurchaseGoal`. The application computes a canonical `ResourceRequirement` from that goal without storing a second editable object or adding a second revision counter. Current resolution covers product discovery, retained commerce evidence, evaluation, comparison, and a human-owned purchase plan. Shopify Global Catalog is the only live provider. Durable decision state is restored from local IndexedDB, while discovery results and execution authority remain transient session state.

WebMCP is one bounded adapter over the same application kernel used by React. It is neither the application owner nor the engine's only future intelligence interface.

## Ownership boundaries

- The requesting human or owning OS defines the requirement and retains consequential authority.
- The CoSource application kernel owns current session workflow, evidence, evaluation, plans, and proposals.
- React and WebMCP are adapters; neither duplicates domain rules or state.
- Providers supply external data through adapter boundaries. Their identities and payload structures do not enter the Resource Requirement.
- Commerce OS remains authoritative for suppliers, purchasing, inventory, and financial consequences.
- CoSource does not choose CORAP strategy, product strategy, creative strategy, conversion strategy, affiliate strategy, or whether to place an order.

## Requirement-to-resolution lifecycle

1. A requester defines intent in its owning context.
2. That intent is committed under human or owning-system authority.
3. CoSource receives or computes a runtime-validated, revisioned Resource Requirement.
4. Provider-independent strategies seek candidate evidence through provider adapters.
5. Evaluation preserves provenance, conflicts, gaps, freshness, and uncertainty.
6. Comparison and planning expose viable alternatives without silently selecting a winner.
7. Agents may propose bounded changes; the requester approves consequential changes.
8. A future authorised integration may execute only when the requirement's approval policy permits it. The current product is recommendation-only.

## Extension seams

The canonical requirement uses bounded strings for evolving resource and requester kinds, structured constraints, exact money, and explicit approval policy. This permits future materials, equipment, services, software, licensed assets, suppliers, packaging, replenishment, and replacement requirements without embedding provider schemas or creating an enum for every resource class.

Remote persistence, monitoring, plan repair, new providers, execution adapters, and CORAP integrations are future seams, not current capabilities. The current exact-money type remains shared from the canonical commerce domain as a temporary compatibility decision; it should move only when a real non-commerce consumer requires a neutral shared value module.

## Non-goals

CoSource does not perform authentication, billing, inventory ownership, supplier-relationship management, cart creation, checkout, payment, purchase-order placement, autonomous consequential approval, or cross-product strategy. R1 introduces no database, monitoring loop, repair engine, new provider, or generic-resource user interface.
