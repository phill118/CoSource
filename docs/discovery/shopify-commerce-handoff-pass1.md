# Shopify commerce handoff — Pass 1

This document records official boundaries checked 2026-08-30. No cart or checkout was created.

## Sources

- [Carts and checkout for agents](https://shopify.dev/docs/agents/carts-and-checkout)
- [Cart MCP](https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp)
- [Checkout MCP](https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp)
- [Auth and rate limiting](https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting)
- [Storefront Catalog MCP](https://shopify.dev/docs/agents/catalog/storefront-catalog)
- [UCP Catalog relationship to checkout](https://ucp.dev/2026-04-08/specification/catalog/)

## Current boundary

```text
Global Catalog (cross-merchant discovery)
  → choose one or more concrete seller variants
  → group variants by merchant
  → merchant cart permalink or merchant Cart MCP
  → merchant Checkout MCP / storefront checkout
  → human review and purchase completion
```

Global Catalog is the only cross-merchant part of this path. Search clusters may contain offers from several merchants, but every observed variant carried its own seller and merchant-specific `checkout_url`. A multi-merchant CoSource result must remain a purchase plan containing separate merchant handoffs; it cannot be represented as one Shopify universal cart or checkout.

## Catalog interfaces

| Concern | Global Catalog | Storefront Catalog |
| --- | --- | --- |
| Scope | Eligible products across Shopify merchants | One merchant domain |
| Endpoint | `https://catalog.shopify.com/api/ucp/mcp` | `https://{storeDomain}/api/ucp/mcp` |
| API key | Not required | Not required |
| Profile | Agent profile required for tool calls | Agent profile required for tool calls |
| Tools | search, lookup, get product | same three tools |
| Lookup batch | up to 50 | up to 10 |
| Search page max | 50 | 250 |
| Extension | `dev.shopify.catalog.global` | merchant/storefront extension |

Use Global Catalog for cross-merchant discovery and comparison. Use Storefront Catalog when buyer intent is already scoped to one merchant or when refreshing merchant-specific product details.

## Handoff choices

1. Catalog cart permalink: each live variant exposed a `checkout_url` that preselects quantity at that merchant. This is the simplest human handoff.
2. Cart MCP: merchant endpoint, long-lived exploratory container, and officially unauthenticated at the anonymous tier. It can estimate totals and returns a merchant `continue_url`. Cart mutation was outside Pass 1.
3. Checkout MCP: merchant endpoint and short-lived transactional session. Official pages are not perfectly consistent in wording: the overview/reference says checkout requires authentication or a signed request, while the general tier matrix currently shows anonymous access to checkout build/edit tools but never `complete_checkout`. Architecture must discover the merchant's live profile and treat authorization as operation- and merchant-specific.

`complete_checkout` is unavailable to anonymous and signed tiers; token authorization and explicit permission are required. Checkout is rate-limited more strictly than Cart MCP. The merchant remains merchant of record, and escalation uses a merchant `continue_url` for buyer review/completion.

## Contract consequences

- Catalog variant GIDs are intended to become checkout `line_items[].item.id`.
- Catalog price and availability are not transactional commitments; revalidate at cart/checkout.
- Group selected offers by seller before cart construction.
- Keep cart IDs and checkout IDs merchant-scoped.
- Never merge totals, shipping promises, tax, discounts, or payment across merchants as if Shopify offered one universal transaction.
- Preserve and display required warning/disclosure messages.
- Reserve checkout creation for confirmed purchase intent; perform iteration in cart state.
- Human authority remains mandatory for high-consequence payment and purchase steps.

## Authentication and profiles

Catalog discovery worked anonymously with Shopify's hosted test profile. Cart is documented as unauthenticated but still requires an agent profile for negotiation. A production CoSource agent will need its own hosted HTTPS UCP profile. Higher-trust tiers use ECDSA P-256 HTTP signatures or Dev Dashboard-issued bearer JWTs. No profile, key, signature, token, account, cart, or checkout was created in Pass 1.

## Open questions for a future authorised pass

- Resolve checkout anonymous-access wording against live merchant profiles before implementation.
- Determine per-merchant Cart/Checkout capability availability and failure behavior.
- Establish safe expiry/revalidation policy for catalog, cart, checkout, and handoff URLs.
- Review human-consent and escalation schemas before any transaction workflow.
- Establish rate-limit handling from live headers without attempting to discover numeric ceilings.
