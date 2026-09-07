# CoSource application kernel

The browser session has one provider-independent application owner:

```text
Human UI → CoSource Application Kernel ← WebMCP
                    ↓
  goal / sourcing / evidence / evaluation / comparison / planning / proposals
                    ↓
            canonical commerce port
```

`createCoSourceApplication` is the composition API. `createBrowserApplication` is the browser composition root and explicitly supplies the same-origin catalog client, the initial `MarketContext`, and the browser-only IndexedDB adapter behind the application persistence port. There is no DI framework, remote persistence, or second application-state owner.

The committed `PurchaseGoal` remains the purchasing surface's sole stored requirement authority. `getActiveResourceRequirement` deterministically projects it into the provider-independent Resource Requirement contract using the same identity and revision. The projection is not stored, independently editable, or separately revisioned.

The kernel also owns the single bounded retained [evidence ledger](evidence-ledger.md). Current evidence and bounded history are included in the durable local projection; per-product refresh lifecycle and request authority remain transient. `retainedProducts` is only its current projection; discovery candidates never own or refresh retained evidence.

Browser reload restores durable decision work through the application-owned [local workspace persistence port](local-workspace-persistence.md). Restoration is atomic and transient execution state is reset; IndexedDB remains below the application boundary and never becomes a second live owner.

## Authoritative owners

- The application session controller owns one stable session identity and monotonic root revision. Its canonical snapshot contains the editable goal draft, reviewable goal-interpretation proposals, human-committed active goal, market context, human and agent discovery workspaces, retained evidence, comparison selection, purchase plan, proposals, and bounded activity. Semantic no-ops do not publish or increment the root revision.
- Existing domain services remain authoritative for validation, sourcing projection, product evaluation, comparison, plan evaluation and mutation, and proposal validation/application.
- React subscribes through `useSyncExternalStore`, invokes complete application use-cases, and renders results. Exploratory search, active-goal sourcing, and agent sourcing are separate application operations; React does not compile and compose a sourcing strategy itself.
- WebMCP validates and bounds transport input/output, then invokes the same application actions. It does not compile strategies, search the catalog, evaluate products or plans, or mutate proposals itself.
- The WebMCP hook owns registration lifecycle only. The application session is the sole owner of activity IDs, timestamps, retention bounds, and consequential sourcing/proposal outcome records.
- The commerce client is an injected port. Product inspection receives the canonical provider identity and explicit session market; provider and Shopify-specific schemas remain below the application boundary.

The live session remains the one in-memory application authority, while its durable projection is restored from and saved to local browser IndexedDB. UK market values are the initial browser composition default, not hidden constants in search or product inspection. Human and agent sourcing both use the authoritative session market. An agent must declare the matching country/currency rather than silently introducing a second market into one evidence registry; mismatches fail before provider access. Tests inject a US/USD session to prove the complete search-and-inspection boundary.

Goal authority has three distinct states. `PurchaseGoalDraft` is human-editable and may be incomplete. A `GoalInterpretationProposal` is bounded validated agent input tied to the session and exact draft revision; it never changes the draft or active goal. The existing validated `PurchaseGoal` serves as the immutable active snapshot only after explicit human commitment. Adopting an interpretation copies canonical fields into the draft but does not commit it.

Draft changes stale revision-bound interpretation proposals, and exact value restoration cannot revive them. A newer pending interpretation explicitly supersedes the older one. Canonical semantic comparison excludes draft/validated state and revision metadata while including identity, summary, search focus, quantity, both money constraints, and all condition collections. A semantic no-op commit preserves active-goal object identity and revision. A genuinely meaningful human commit revokes in-flight and accepted goal-driven discovery, but never silently rebases a populated plan or pending plan proposal.

Human and agent discovery are independent revisioned workspaces. Each records mode, lifecycle status, query, market, strategy and goal revision where applicable, request identity, accepted request identity, bounded messages, candidates, pagination, and safe error state. Channel-local authority tokens make the latest request win. Goal changes revoke old goal-sourcing tokens, agent dismissal revokes agent tokens, and continuation requests must match current mode, query, criteria, and cursor before provider access. Provider failures are published once by the workspace; React renders that canonical error and uses local validation only when no discovery error lifecycle was created.
