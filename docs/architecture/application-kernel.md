# CoSource application kernel

The browser session has one provider-independent application owner:

```text
Human UI → CoSource Application Kernel ← WebMCP
                    ↓
  goal / sourcing / evidence / evaluation / comparison / planning / proposals
                    ↓
            canonical commerce port
```

`createCoSourceApplication` is the composition API. `createBrowserApplication` is the browser composition root and explicitly supplies the same-origin catalog client plus the initial `MarketContext`. There is no DI framework and no persistence.

## Authoritative owners

- The application session controller owns one stable session identity and monotonic root revision. Its canonical snapshot contains the editable goal draft, last valid active goal, market context, human and agent discovery workspaces, retained evidence, comparison selection, purchase plan, proposals, and bounded activity. Semantic no-ops do not publish or increment the root revision.
- Existing domain services remain authoritative for validation, sourcing projection, product evaluation, comparison, plan evaluation and mutation, and proposal validation/application.
- React subscribes through `useSyncExternalStore`, invokes complete application use-cases, and renders results. Exploratory search, active-goal sourcing, and agent sourcing are separate application operations; React does not compile and compose a sourcing strategy itself.
- WebMCP validates and bounds transport input/output, then invokes the same application actions. It does not compile strategies, search the catalog, evaluate products or plans, or mutate proposals itself.
- The WebMCP hook owns registration lifecycle only. The application session is the sole owner of activity IDs, timestamps, retention bounds, and consequential sourcing/proposal outcome records.
- The commerce client is an injected port. Product inspection receives the canonical provider identity and explicit session market; provider and Shopify-specific schemas remain below the application boundary.

The session is intentionally browser-memory-only. UK market values are the initial browser composition default, not hidden constants in search or product inspection. Human and agent sourcing both use the authoritative session market. An agent must declare the matching country/currency rather than silently introducing a second market into one evidence registry; mismatches fail before provider access. Tests inject a US/USD session to prove the complete search-and-inspection boundary.

The draft may be temporarily invalid while a human edits it; the last validated active goal remains authoritative until another meaningfully changed valid draft replaces it. Canonical semantic comparison excludes draft/validated state and revision metadata while including identity, summary, search focus, quantity, both money constraints, and all condition collections. Restoring the exact prior valid intent therefore advances the editable draft revision but preserves the active-goal object and revision; goal-driven discovery, populated plans, and pending proposals remain current. A genuinely meaningful replacement revokes in-flight and accepted goal-driven discovery, but never silently rebases a populated plan or pending proposal.

Human and agent discovery are independent revisioned workspaces. Each records mode, lifecycle status, query, market, strategy and goal revision where applicable, request identity, accepted request identity, bounded messages, candidates, pagination, and safe error state. Channel-local authority tokens make the latest request win. Goal changes revoke old goal-sourcing tokens, agent dismissal revokes agent tokens, and continuation requests must match current mode, query, criteria, and cursor before provider access. Provider failures are published once by the workspace; React renders that canonical error and uses local validation only when no discovery error lifecycle was created.
