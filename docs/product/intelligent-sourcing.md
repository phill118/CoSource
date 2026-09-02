# Intelligent sourcing

The application kernel exposes distinct use-cases for literal exploratory search, complete active-goal sourcing, and agent sourcing. `sourceCandidatesForActiveGoal` reads the last valid active goal, compiles the canonical strategy, performs real-market search, and updates the human discovery workspace as one operation. React owns only presentation state. Evidence-gap analysis remains an application use-case, while provider filter mapping remains in the commerce layer.

Human and agent discovery have independent latest-request authority. Starting a new initial request clears old candidate ownership before provider access. Late successes and failures return `stale_state` without publishing. Pagination belongs to the current workspace mode, query, criteria, and cursor. A changed active goal revokes older goal-derived requests; dismissing agent candidates revokes an in-flight agent request. React explicitly labels accepted goal-derived results and strategy as stale after such a change, suppresses their continuation cursor, and offers a fresh source action against the current goal.

CoSource’s goal-driven flow is:

```text
validated human goal
→ deterministic DiscoveryStrategy
→ provider-supported canonical constraints
→ real-market gateway search
→ explicit evidence gaps
→ product evaluation
→ agent refinement and human engagement
```

The human supplies both the complete outcome summary and the product/category being sourced. CoSource does not infer a query with runtime NLP. Maximum item price and overall plan budget are distinct canonical money values; only a same-currency maximum item price may become a search ceiling.

For Shopify Global Catalog, CoSource currently projects sale-ready availability, ships-to country, maximum price in minor units, exact `new`/`secondhand` condition, and exact `Color`, `Size`, or `Target gender` taxonomy constraints. Unsupported requirements remain evidence gaps. Availability never proves requested inventory quantity, and delivery, shipping, tax, suitability, and final totals remain unknown unless authoritative evidence exists.

The `search_products` WebMCP tool calls CoSource’s same-origin gateway, never Shopify directly. It must use the current session country and currency; a conflicting agent market is rejected before network access so that candidates cannot later be inspected under a different market. Its separate session-only agent workspace holds at most ten candidates in total across all pages. A continuation accepts only the remaining capacity; reaching ten closes pagination, removes the usable cursor, and makes further continuation fail before provider access. Tool responses expose only candidates accepted into canonical state, and discarded overflow cannot refresh retained evidence. Candidates become retained decision evidence only when the human inspects or compares them. Human pagination is not subject to the agent bound. Search never changes the purchase plan; plan changes still require a proposal and explicit human approval.
