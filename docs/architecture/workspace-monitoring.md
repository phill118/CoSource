# Workspace monitoring

S8 adds a derived, project-scoped health projection. It aggregates canonical reads and never persists findings, calls a provider, allocates identifiers, or replaces an owning evaluator.

## Ownership audit

Goal commitment and draft divergence belong to the application goal boundary. Evidence observations, freshness, conflicts, and human verification belong to the evidence ledger and resolution projection. Product readiness belongs to product evaluation; landed-cost completeness belongs to costing; supplier quotation, reliability, standing, and risk belong to supplier intelligence. Comparison and whole-plan readiness belong to the plan evaluator. Scenario generation and staleness belong to scenario optimisation. Operational lifecycle and safe next action belong to supervised operational cases. Storage availability, saving, conflict, recovery, and retry belong to the persistence controller. Registration and the fixed tool contract belong to the WebMCP adapter.

Monitoring reads those owners once at an application-owned instant. Its fingerprint binds the goal and plan revisions, canonical issue phases, scenario basis, operational phases, and available composition state. Stable identities and ordering make repeated reads in one phase deterministic. Status precedence is `unavailable`, `blocked`, `attention_required`, then `ready`; there is no score or confidence percentage. Without a committed goal, downstream noise is suppressed.

S8R threads that single captured instant through evidence freshness, verification applicability, supplier validity and risk, plan and scenario evaluation, and operational staleness. A separate pure composition boundary combines the project snapshot with normalized persistence and WebMCP runtime facts supplied by their actual React owners. The composed result—not React—is authoritative for status, counts, ordering, highest-priority reason, routes, and repair metadata. The application-only WebMCP read exposes project facts and deliberately does not fabricate browser registration state.

## Supervised repair

An executable recommendation contains an exact finding, basis, target, and provider binding where required. The application recomputes health and rejects malformed, stale, missing, or changed findings before delegating. Evidence refresh uses the existing single-subject refresh authority and operational rebase uses the existing pre-handoff case authority. Persistence retry remains a React composition over the existing persistence controller. Other routes are navigation or information only. There is no automatic repair, polling, reconciliation, goal commitment, scenario application, external handoff, or purchase execution.

WebMCP keeps its thirteen tools. `get_goal_context` exposes only a bounded descriptive health summary and receives no repair authority.

Routes use one closed mapping to existing anchors for goal definition, evidence resolution, planning, supplier intelligence, supervised operations, persistence status, and WebMCP status. Persistence retry is rendered once from the composed finding, delegates to the shared controller operation, and announces the resulting lifecycle rather than assuming success when the promise settles.

Non-retryable persistence conflicts and unavailable states use the informational `inspect_persistence` route to the persistence surface. They never navigate to plan review or imply repair authority. Retryable states retain the executable `retry_persistence` route.
