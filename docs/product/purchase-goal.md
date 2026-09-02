# Purchase Goal

Pass 5 lets a human explicitly describe purchasing intent before or while using real product discovery. Editable state is a `PurchaseGoalDraft`, which may be temporarily incomplete. Only successful runtime finalisation produces a discriminated, validated `PurchaseGoal` suitable for future evaluation or WebMCP consumers. Both preserve the stable session identity and current revision.

Conditions support a deliberately small generic vocabulary: free text, equality, boolean true/false, numeric maximum, and numeric minimum. CoSource does not infer fields or operators from the summary. The structured preview shows exactly what the user entered.

Budget values use canonical integer minor units and an explicit user-selected currency. The currency choices come from the runtime's complete `Intl.supportedValuesOf("currency")` set, with GBP as the initial UK-facing selection. Browser `Intl.NumberFormat` metadata determines fraction digits. Decimal strings are converted exactly using string padding and `BigInt` range checks before canonical `Money` creation; no floating-point multiplication or foreign-exchange conversion is performed.

Every edit increments the goal revision while its identity remains stable for the browser session. Nothing is persisted to storage or a database. The state is shaped for later reuse by WebMCP and product-evaluation services, but Pass 5 registers no tools and performs no evaluation.

Finalisation also requires condition identifiers to be unique across requirements, preferences, and exclusions. Ambiguous duplicate identities are rejected rather than renamed.

The optional **Use goal summary as search** action copies the literal summary into the existing keyword input. It performs no interpretation, enrichment, matching, ranking, or recommendation.
# Pass 10 sourcing fields

`searchFocus` is the human-entered product/category being sourced and remains distinct from the full outcome summary. `maximumItemPrice` is canonical `Money` for a single returned item offer and is separate from the overall `budget` used by whole-plan evaluation. CoSource performs no FX and never treats the overall budget as a unit-price ceiling.
