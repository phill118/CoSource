# Product discovery UI

Pass 4 provides the first user-facing CoSource commerce workflow. Users can search ordinary retail products, browse canonical product clusters, load cursor-based continuation pages, and request richer product detail containing merchant offers.

The browser calls only `/api/catalog/search` and `/api/catalog/product`. Live data comes from Shopify Global Catalog through the secure CoSource gateway. Public gateway responses are runtime-validated before rendering; malformed responses become safe UI errors.

Search cards use **Featured offer** only when the canonical provider evidence identifies exactly that returned offer. Without that evidence, a first provider-ordered offer may be shown neutrally as **Returned offer**. Search output is not an exhaustive merchant listing. Product detail preserves provider order and does not identify a cheapest, best, or recommended merchant.

Every price includes its returned ISO currency. Canonical minor-unit integers are scaled and displayed using the runtime's `Intl.NumberFormat` ISO currency fraction metadata; unsupported identifiers are reported safely rather than receiving assumed decimals. No conversion or cross-currency comparison is performed. Availability uses cautious catalog-signal wording: **Listed as available**, **Unavailable**, or **Availability not confirmed**. Provider-inferred descriptions are labelled and accompanied by verification guidance.

Product options are displayed read-only in this pass. Purchase goals, ranking, recommendations, optimisation, carts, checkout, accounts, AI, and WebMCP remain out of scope.
# Pass 10 goal-driven sourcing

Literal manual search remains a separate exploratory application use-case. **Source against this goal** invokes one complete active-goal application operation that compiles the validated goal’s explicit product focus into a `DiscoveryStrategy`, stores it, applies only supported canonical constraints, and updates the candidate workspace. Continuation pages repeat that same goal-owned use-case rather than asking React to reassemble strategy and search arguments. Every unprojectable requirement is displayed as an evidence gap. Provider messages remain external data. Unexpected same-currency offers above the maximum item price are shown as known conflicts rather than viable candidates.
