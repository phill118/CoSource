# Purchase Goal

Purchasing intent has three application-owned states. `PurchaseGoalDraft` is the human-editable working intent and may be incomplete. `GoalInterpretationProposal` is bounded agent interpretation submitted through WebMCP for visible human review. The validated `PurchaseGoal` is the active snapshot used by sourcing, evaluation, and planning only after the human explicitly commits the draft.

Submitting an interpretation changes neither draft nor active goal. It records the exact session, source draft identity/revision, proposed canonical fields, notes, assumptions, unresolved questions, timestamp, and review status. Agent interpretation is validated input, not evidence that any product has a property. CoSource contains no keyword parser, embedded model call, or hidden auto-application.

The human may reject a current proposal or adopt it into the draft. Adoption remains editable and does not activate the goal. Meaningful draft edits make a pending interpretation stale; semantic no-ops do not. Exact restoration after intervening revisions does not revive stale authority, and a newer pending proposal supersedes the older one. Only explicit commit validates and replaces active authority; semantic no-op commits preserve the existing active object and revision.

Conditions support a deliberately small generic vocabulary: free text, equality, boolean true/false, numeric maximum, and numeric minimum. CoSource does not infer fields or operators from the summary. The structured preview shows exactly what the user entered.

Budget values use canonical integer minor units and an explicit user-selected currency. The currency choices come from the runtime's complete `Intl.supportedValuesOf("currency")` set, with GBP as the initial UK-facing selection. Browser `Intl.NumberFormat` metadata determines fraction digits. Decimal strings are converted exactly using string padding and `BigInt` range checks before canonical `Money` creation; no floating-point multiplication or foreign-exchange conversion is performed.

Every meaningful draft edit increments the draft revision while its identity remains stable for the browser session. Draft and active revisions are separate authority markers. Nothing is persisted to storage or a database.

Finalisation also requires condition identifiers to be unique across requirements, preferences, and exclusions. Ambiguous duplicate identities are rejected rather than renamed.

The optional **Use goal summary as search** action copies the literal summary into the existing keyword input. It performs no interpretation, enrichment, matching, ranking, or recommendation.
# Pass 10 sourcing fields

`searchFocus` is the human-entered product/category being sourced and remains distinct from the full outcome summary. `maximumItemPrice` is canonical `Money` for a single returned item offer and is separate from the overall `budget` used by whole-plan evaluation. CoSource performs no FX and never treats the overall budget as a unit-price ceiling.

Provider capability modelling, multi-provider orchestration, candidate intelligence, evidence-resolution loops, planning intelligence, broader WebMCP consolidation, reliability gates, and universal acceptance remain deferred to B4–B12.
