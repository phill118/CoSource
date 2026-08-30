# Shopify Global Catalog discovery — Pass 1

Evidence captured 2026-08-30 from official documentation and anonymous, read-only calls to Shopify's live Global Catalog. Live catalog contents are transient; identifiers and prices below are observations, not durable fixtures or offers.

## Executive finding

CoSource can query Global Catalog without a Shopify merchant account, app, OAuth grant, or API key. Tool calls require an HTTPS UCP agent-profile URL in `arguments.meta["ucp-agent"].profile`. Shopify's public profile fixture worked for discovery; a production CoSource agent should eventually publish its own profile. No architecture blocker was found.

## Official sources

- [About Catalogs](https://shopify.dev/docs/agents/catalog)
- [Global Catalog MCP](https://shopify.dev/docs/agents/catalog/global-catalog)
- [Global Catalog extension](https://shopify.dev/docs/agents/catalog/global-catalog-extension)
- [Agent profiles and UCP negotiation](https://shopify.dev/docs/agents/profiles)
- [Auth and rate limiting](https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting)
- [UCP Catalog capability](https://ucp.dev/2026-04-08/specification/catalog/)
- [Shopify test profile](https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json)

All were checked on 2026-08-30. The observed protocol and capability family was `2026-04-08`.

## Endpoint, protocol, and negotiation

- Endpoint: `POST https://catalog.shopify.com/api/ucp/mcp`
- Transport: JSON-RPC 2.0 MCP binding.
- Live response envelope: `result.structuredContent` with `ucp.version`, negotiated `ucp.capabilities`, and `ucp.status`.
- Negotiated capabilities observed: `dev.ucp.shopping.catalog.search`, `dev.ucp.shopping.catalog.lookup`, and Shopify extension `dev.shopify.catalog.global`, all version `2026-04-08`.
- The live extension declares a minimum protocol of `2026-04-08`.
- Shopify's test profile advertises the UCP shopping MCP service and catalog search/lookup plus other shopping capabilities. Server-selects negotiation intersects agent and business capabilities.

The live `tools/list` call returned HTTP 200 both with no `params` and with profile metadata in `params.meta`. This differs from the broad documentation statement that every request needs a profile. The returned tool schemas themselves require `meta` and `catalog`, and live `tools/call` without `meta` returned HTTP 422. Treat the profile as mandatory for tool execution, not demonstrably mandatory for unparameterized `tools/list`.

## Live tools and schemas

`tools/list` returned exactly:

1. `search_catalog` — global search, including query, context, signals, filters, pagination, saved-catalog ID, view, and similarity inputs.
2. `get_product` — one product by ID with selected options and preference ordering.
3. `lookup_catalog` — batch identifiers with result correlation.

Important live-schema limits:

- Lookup IDs: 1–50.
- Search page size: minimum 1; documentation states default 10 and maximum 50.
- Documented pagination depth: 1,000 results; `total_count` is estimated.
- Shops filter: at most 1,000 shop GIDs.
- Attribute filters: at most 25; at most 50 values per attribute.
- Similarity inputs: 1–2 product/variant GIDs or inline images.
- Documented supported attribute names: `Color`, `Size`, `Target gender`.

No official numeric request-per-time rate limit was found. Shopify documents Token, Signed, and Anonymous tiers in descending allowance. The bounded live run eventually received HTTP 429 in the anonymous tier; no threshold is inferred from that observation.

## Search request and matrix

Representative call shape:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 10,
  "params": {
    "name": "search_catalog",
    "arguments": {
      "meta": {
        "ucp-agent": {
          "profile": "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json"
        }
      },
      "catalog": {
        "query": "USB-C laptop charger 65W",
        "context": {
          "address_country": "GB",
          "language": "en-GB",
          "currency": "GBP"
        },
        "filters": {
          "available": true,
          "ships_to": { "country": "GB" }
        },
        "pagination": { "limit": 3 }
      }
    }
  }
}
```

Four bounded queries were run with that GB context: `USB-C laptop charger 65W`, `merino wool hiking socks`, `adjustable LED desk lamp`, and `adjustable spanner 200mm`. Each returned three products and an opaque next cursor. Estimated totals observed were in the hundreds and must not be treated as exact.

Observed response fields included UPID, title, inferred product description, rating, normalized options, inferred feature/specification metadata, image URL and alt text, variant GID, variant description and URL, price, currency, availability, selected options, seller ID/name/URL/domain/policy links, checkout URL, inferred condition, native-checkout eligibility, price range, messages, and pagination.

GB localization frequently returned GBP but did not guarantee it. A GB-address, GBP-preference, ships-to-GB lamp query returned both GBP and USD offers. UCP defines context as provisional hints, with response currency authoritative for the returned price. A `price.max=1000` GBP request produced an informational message that filtering was performed on a USD basis after FX conversion and contextualized return prices could differ.

## Product identity and multi-merchant behavior

- Global product identity observed as `gid://shopify/p/{upid}`.
- Purchasable offer/variant identity observed as `gid://shopify/ProductVariant/{id}`.
- Seller identity observed as `gid://shopify/Shop/{id}` plus seller fields.
- Search results are product clusters containing variants; search commonly returned only a featured variant.
- Thirty additional bounded branded search results each exposed one seller, so a multi-offer search card was not directly observed there.
- A lookup/get-product round trip for `gid://shopify/p/3E7RET7UBEbf9e8VvnLIBJ` did prove clustering. Lookup grouped variants from two sellers with a GBP 20.00–29.00 range. `get_product` with `Size=M` returned six variants across four merchants, each with its own variant GID, price, availability, seller, product URL, and checkout URL.

This proves cross-merchant clustering live, while also showing that search's featured representation is not exhaustive.

## Lookup round trip

Inputs were a live UPID, a live variant GID, and a nonexistent but well-formed variant GID in one request.

- HTTP/JSON-RPC operation succeeded.
- Multiple identifiers were accepted.
- Results were grouped under one product cluster.
- A variant selected by UPID had `inputs[].match = "featured"`.
- The explicitly supplied variant had both the UPID `featured` correlation and variant-ID `exact` correlation.
- The missing identifier appeared in `messages` as `{type: "info", code: "not_found", content: <input>}`.
- Documentation and live schema specify a 50-ID maximum.
- Official docs additionally accept UPIDs, Shopify variant GIDs, and Shopify HTTP(S) product URLs. Only UPID and variant GID were live-tested here.

## Get-product round trip

Calling the same UPID without a selection returned a selected featured offer and option availability (`available`, `exists`). Calling it with `selected: [{"name":"Size","label":"M"}]` and `preferences: ["Size"]` returned the selected value and matching variants across merchants.

Important behavior: option selection can change the featured merchant/product title and returned offer set. A UPID is therefore a cluster key, not a promise that one merchant remains selected between calls. Each returned `checkout_url` was merchant-specific and quantity-prefilled. `eligible.native_checkout` was `false` in observed variants.

## Filters and pagination

Official/live-supported filters include price, available, condition, ships-to, ships-from, shops, categories, attributes, rating, and price tier. Search also supports text, product/variant/image similarity, and an `offer` view.

Live checks proved:

- `available=true` and `ships_to.country=GB` were accepted.
- Integer minor-unit price filtering was accepted.
- Unsupported attributes are ignored and reported in a structured info message listing supported names.
- A two-result cursor produced a distinct second page while retaining the request's limit.
- Cursor is opaque and must be replayed with the same search constraints.

No claim is made that `ships_to` proves final deliverability, cost, or delivery date; checkout remains authoritative.

## Failure contracts

- Unknown tool: HTTP 422.
- Missing required profile on a tool call: HTTP 422.
- `filters.price` supplied as a string: HTTP 200, `result.isError=true`, with a text validation message naming the invalid JSON path.
- Mixed valid/invalid lookup IDs: successful result plus informational `not_found` message.
- Later calls received HTTP 429 after the bounded anonymous sequence. No sensitive internal data was observed in the captured errors.

Two intended invalid-input probes were rate-limited before their semantic errors could be observed. Retry behavior was not tested. Official Cart guidance says honor `Retry-After` and use exponential backoff with jitter.

## What is absent or insufficient

Not reliably established in the tested responses: final shipping charge, delivery commitment, taxes, stock quantity, inventory location, authoritative compatibility, merchant warranty interpretation, returns eligibility for a specific purchase, exhaustive category/tags/barcodes/SKUs, or native checkout eligibility beyond the observed false values. Ratings were present on some results but their source methodology was not exposed. Catalog values are discovery-time terms, not transactional commitments.

## Architecture conclusion

The agreed architecture remains valid. Provider-specific UCP/Shopify envelopes, IDs, inferred fields, contextual currencies, messages, and merchant-specific handoff URLs belong behind an adapter. UI and future WebMCP paths should consume the same normalized, provenance-aware services. No production interface is proposed in this pass.

Open questions for later controlled work: production profile hosting and cache behavior; practical anonymous/token quotas; stability expectations for UPIDs; URL/offer expiry; full semantics of saved catalogs; rating provenance; shipping-estimate fidelity; and reconciliation when a cluster's featured merchant changes.
