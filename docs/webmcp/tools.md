# WebMCP read tools

CoSource uses the current imperative WebMCP API at `document.modelContext.registerTool()`. Each registration supplies `name`, `description`, a strict JSON `inputSchema`, `execute`, read-only annotations, and a shared `AbortSignal`. Aborting that signal unregisters the tools on React teardown. Registration is atomic from CoSource's perspective: if any one of the seven registrations fails, the lifecycle owner immediately aborts the shared signal, resets the logical tool count to zero, and reports an error rather than leaving a partial set active. The application feature-detects `document.modelContext`; it does not polyfill WebMCP or imply that an agent is connected.

The seven registered tools are:

- `get_purchase_goal`: returns only the current validated goal, or structured unavailability.
- `get_purchase_plan`: returns the current plan identity, revisions, stale/status state, and bounded lightweight lines.
- `evaluate_purchase_plan`: invokes the authoritative Pass 7 whole-plan evaluator.
- `list_retained_products`: lists at most 50 concise canonical products retained by this session workspace.
- `inspect_product`: returns bounded canonical evidence for one retained provider-scoped identity.
- `evaluate_product`: invokes the authoritative Pass 6 evaluator for one retained product and current validated goal.
- `compare_products`: evaluates and compares two retained products through the existing Pass 6/7 services, including legitimate no-winner outcomes.

All tools are read-only. There are no add, remove, quantity, offer-selection, rebase, cart, or checkout tools in Pass 8. Identity inputs require a supported canonical provider and an ID of 1–500 characters; schemas reject additional properties, URLs, endpoints, and raw provider parameters.

Product output is bounded by product, line, offer, option, attribute, description, and string limits. Truncation is explicit. Raw Shopify/UCP envelopes, media collections, policy links, and merchant handoff URLs are not exposed. Provider-created text is returned only in ordinary data fields and marked `untrusted_commerce_data`; tool instructions never incorporate or execute that text.

Handlers read the latest application snapshot at invocation time, so goal revisions, plan revisions, stale state, quantities, and refreshed retained evidence remain current without re-registering tools. The visible **Agent tools** panel truthfully reports ready/unavailable status and the latest 20 invocation names/outcomes. It does not claim an agent connection.

Current Chrome documentation describes WebMCP as Early Preview. For local Chrome 149+ testing, enable `chrome://flags/#enable-webmcp-testing`; DevTools inspection additionally uses `#devtools-webmcp-support`. The official Model Context Tool Inspector can discover and manually call registered tools. Local automated tests use a fake standards-shaped `modelContext` to cover registration, strict inputs, execution, freshness, activity, and abort cleanup without pretending native browser support exists.
