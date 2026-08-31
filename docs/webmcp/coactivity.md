# Human/agent co-activity

Agents can inspect the same current purchase goal, retained canonical evidence, evaluation, comparison, plan, and proposal status as the human. Canonical evidence is retained when the human opens product detail, selects a comparison candidate, or adds a product to the plan; ordinary search-result appearance is not enough. Richer detail refreshes the same provider-scoped registry entry without changing plan revision. The only agent-originated write is `propose_plan_changes`, which creates a bounded session proposal for review. Proposal creation never changes the purchase plan.

Each proposal records its stable identity, agent/WebMCP source, timestamp, target plan identity/revision, expected current goal identity/revision, concise reason, and ordered closed-union operations. Product and offer identities must match retained canonical evidence. Inputs cannot contain URLs, provider configuration, code, checkout, payment, or arbitrary patches. A proposal contains at most 20 operations.

The visible review UI shows each operation and a before/after preview from the authoritative plan evaluator. The human may reject it without changing the plan or choose **Approve and apply**. Approval rechecks proposal status and both revision pairs, then applies the ordered operations to a temporary plan using the existing Pass 7 mutation functions. Any invalid or no-op operation fails the entire application; only a successful temporary result replaces the live plan.

Human plan edits and goal revisions make pending proposals stale. Stale proposals cannot apply and are retained in session history. An applied proposal means only that CoSource plan state changed. It does not mean an order, cart, checkout, payment, merchant request, or purchase occurred.

The session-only activity feed records read calls, agent proposal creation, human rejection, human approval with CoSource application, and stale transitions. It stores concise attribution rather than full product descriptions or persistent analytics.
