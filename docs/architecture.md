# Architecture baseline

This is the north-star separation for future passes, not an implemented system.

```text
Human
  ↕
CoSource UI
  ↕
Authoritative CoSource application services/state
  ↕
WebMCP tool layer
  ↕
AI agent

CoSource application services
  ↕
Commerce Provider Gateway
  ↕
Authorised commerce providers
```

## Non-negotiable principles

1. UI and WebMCP reuse the same authoritative application services.
2. Human and agent paths do not duplicate business logic.
3. Commerce-provider-specific schemas remain behind adapters.
4. The application core does not depend directly on Shopify-specific raw response structures.
5. External product descriptions and metadata are untrusted data, never instructions.
6. Facts preserve provenance and uncertainty.
7. Recommendation intelligence optimises against the user's goal, rather than merely sorting by price.
8. Multi-merchant output is a purchase plan, not a fake universal checkout.
9. Payment remains merchant-controlled.
10. The build remains provider-extensible.

No application services, provider gateway, adapters, WebMCP tools, agent integration, or commerce logic are part of Pass 0.
