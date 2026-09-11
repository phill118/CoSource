# WebMCP tools

Saved-project management is human-only and outside WebMCP. The surface remains exactly thirteen tools: switching aborts the old registration signal and binds a fresh set to the new active application; unresolved restoration exposes zero tools. There is no project listing, creation, rename, switch, migration, recovery, deletion, account, or tenant tool.

Backend B1 makes WebMCP a transport adapter over the canonical application kernel. Tool handlers validate schemas and bound untrusted output, but all sourcing, evidence, evaluation, comparison, plan, and proposal operations delegate to the same live browser-session application used by React.

CoSource uses the current imperative WebMCP API at `document.modelContext.registerTool()`. Each registration supplies `name`, `description`, a strict JSON `inputSchema`, `execute`, accurate annotations, and a shared `AbortSignal`. Aborting that signal unregisters the tools on React teardown. Registration is atomic from CoSource's perspective: if any one of the thirteen registrations fails, the lifecycle owner immediately aborts the shared signal, resets the logical tool count to zero, and reports an error rather than leaving a partial set active. The application feature-detects `document.modelContext`; it does not polyfill WebMCP or imply that an agent is connected.

The thirteen registered tools are:

- `get_resource_requirement`: returns the canonical Resource Requirement projected from the current human-committed purchase goal, or structured unavailability. This replaces the purchase-specific read contract; it does not create separately editable requirement state.
- `get_goal_context`: returns bounded current draft context, separate active-goal context, session identity, and explicit human-authority guidance.
- `propose_goal_interpretation`: validates and stores a structured, revision-bound interpretation proposal for human review. It cannot adopt, reject, commit, source, or mutate the active goal.
- `get_purchase_plan`: returns the current plan identity, revisions, stale/status state, and bounded lightweight lines.
- `evaluate_purchase_plan`: invokes the authoritative Pass 7 whole-plan evaluator.
- `list_retained_products`: lists at most 50 concise canonical products introduced to the session workspace by explicit human detail, comparison, or plan engagement.
- `inspect_product`: returns bounded canonical evidence for one retained provider-scoped identity.
- `evaluate_product`: invokes the authoritative Pass 6 evaluator for one retained product and current validated goal.
- `compare_products`: evaluates and compares two retained products through the existing Pass 6/7 services, including legitimate no-winner outcomes.
- `propose_plan_changes`: creates bounded, session-only proposal state for human review; it does not mutate the plan and is correctly marked `readOnlyHint: false` because it changes proposal state.
- `get_plan_proposals`: returns at most 20 proposal records with effective status and expected/current revision context.
- `search_products`: searches real external commerce through the same-origin gateway using the declared country/currency only when they match the authoritative session market, and stores at most ten total session agent candidates across all pages without retaining them or mutating the plan. Each response exposes only products accepted into that canonical bound; pagination closes and its cursor becomes unusable when the workspace reaches ten.
- `get_evidence_gaps`: returns bounded discovery and optional retained-product gaps, including unverifiable bulk quantity.

Retained-product, inspection, evaluation, comparison, plan-evaluation, and gap results share the kernel's bounded observation summaries, freshness vocabulary, conflict semantics, and qualitative decision readiness. Observation history is summarized rather than exposed as an unrestricted provider-data archive. The registered count remains thirteen; agents cannot refresh evidence, mark it verified, dismiss conflicts, or override freshness.

Browser tool registration waits until local workspace restoration reaches a safe initialized state. Tools therefore read the restored canonical kernel rather than a temporary pre-hydration session. Persistence recovery, record clearing, and conflict resolution are not agent authorities.

Ten intelligence/status tools are read-only. `propose_goal_interpretation` changes interpretation-proposal state only, `propose_plan_changes` changes plan-proposal state only, and `search_products` changes only the bounded agent-candidate workspace. There is deliberately no agent tool for adopting, rejecting, committing, or activating a goal and no `apply_plan_changes` tool. Schemas reject additional properties, URLs, endpoints, raw provider parameters, and arbitrary object patches.

Interpretation input bounds all strings and arrays, validates exact integer money and supported ISO currency through the goal domain, and excludes product/provider evidence, checkout instructions, and plan operations. Returned interpretation data is bounded and marked as validated agent input rather than commerce evidence.

Product output is bounded by product, line, offer, option, attribute, description, and string limits. Truncation is explicit. Raw Shopify/UCP envelopes, media collections, policy links, and merchant handoff URLs are not exposed. Provider-created text is returned only in ordinary data fields and marked `untrusted_commerce_data`; tool instructions never incorporate or execute that text.

Handlers read the latest canonical session snapshot at invocation time, including the last valid active goal, root revision, discovery lifecycle, plan revisions, stale state, quantities, market, and refreshed retained evidence. Agent pagination uses the same application-owned request authority as human discovery; mismatched, superseded, or capacity-exhausted continuations fail safely without provider access or stale publication. Provider search failures remain application-workspace errors rather than being copied into a second adapter-owned error. The WebMCP hook owns only unavailable/registering/ready/error state and registered tool count. The visible **Agent tools** panel renders the application-owned latest 20 invocation names/outcomes and does not claim an agent connection.

Current Chrome documentation describes WebMCP as Early Preview. For local Chrome 149+ testing, enable `chrome://flags/#enable-webmcp-testing`; DevTools inspection additionally uses `#devtools-webmcp-support`. The official Model Context Tool Inspector can discover and manually call registered tools. Local automated tests use a fake standards-shaped `modelContext` to cover registration, strict inputs, execution, freshness, activity, and abort cleanup without pretending native browser support exists.
## Supplier information

The existing read and evaluation tools may return bounded supplier summaries applicable through exact merchant identity links. The tool set remains 13 tools and exposes no supplier mutation, outreach, ordering, checkout, or payment authority.
