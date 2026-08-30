# Shopify Global Catalog field and trust matrix

Classification is based on official Shopify/UCP documentation checked 2026-08-30 plus Pass 1 live observations. “Explicit” means returned as a commerce term or identifier; catalog terms remain non-transactional until revalidated at checkout.

| Field or concept | Live observed | Classification | Notes |
| --- | --- | --- | --- |
| `product.id` (`gid://shopify/p/...`) | Yes | Explicit platform identity | UPID cluster key; scope is Shopify Global Catalog. |
| `variant.id` (`gid://shopify/ProductVariant/...`) | Yes | Explicit commerce identity | Purchasable merchant offer; UCP says use as checkout item ID. |
| `seller.id` (`gid://shopify/Shop/...`) | Yes | Explicit platform identity | Seller/shop scope. |
| Seller name, URL, domain | Yes | Explicit seller context | Validate URLs before navigation; names are not independently verified legal identity. |
| Seller policy links | Sometimes | Explicit links | Presence varies; linked policy content was not evaluated. |
| Variant price and currency | Yes | Explicit current catalog term | Integer ISO 4217 minor units. Checkout is authoritative. |
| Product price range | Yes | Explicit aggregate | Range can span multiple sellers/offers. |
| Variant availability boolean | Yes | Explicit catalog signal | “Sale-ready” signal, not stock quantity or fulfillment guarantee. |
| Variant selected options | Yes | Explicit offer selection | Merchant offer state. |
| Variant/product URL | Yes | Explicit provider link | Treat as untrusted URL; query parameters appeared session/attribution-like. |
| `checkout_url` | Yes | Explicit merchant handoff | Merchant-specific cart permalink, not a universal checkout. |
| `eligible.native_checkout` | Yes (`false`) | Explicit capability signal | Do not infer future eligibility from one response. |
| Product title | Yes | Explicit catalog content | External untrusted text; cluster title can vary with selected offer. |
| Variant description | Yes | External merchant/catalog content | Untrusted; source attribution was not explicit in payload. |
| Product `description` | Yes | Shopify-inferred | Officially marked inferred/enriched. |
| Product `options` | Yes | Shopify-inferred | Normalized for discovery and variant selection. |
| `metadata.attributes` | Not in selected excerpt | Shopify-inferred | Officially classified inferred; optional. |
| `metadata.tech_specs` | Yes | Shopify-inferred | Sometimes internally inconsistent; discovery signal only. |
| `metadata.top_features` | Yes | Shopify-inferred | Discovery/merchandising signal. |
| `metadata.unique_selling_points` | Yes | Shopify-inferred | Discovery/merchandising signal. |
| `variants[].condition` | Yes (`new`) | Shopify-inferred | Known values documented as `new`, `secondhand`. |
| Ratings/counts | Sometimes | Unknown provenance | Explicit values but origin/methodology not exposed in tested payload. |
| Images and alt text | Yes | External catalog content | URLs and text are untrusted; media type can also be video/model per UCP. |
| Product categories/tags/SKU/barcodes | Not reliably observed | Unknown/optional | Supported by base UCP, but absence is common and semantics can vary. |
| `inputs[].match` | Yes | Explicit correlation metadata | `exact` for supplied offer ID; `featured` for server-selected UPID result. |
| Pagination cursor | Yes | Explicit opaque control | Do not parse; replay with unchanged constraints. |
| `total_count` | Yes | Estimate | Officially not exact. |
| Response `messages` | Yes | Explicit contract context | Preserve type/code/path/content; warnings/disclosures may have display obligations. |
| Address/currency/language context | Sent | Provisional input hint | UCP says it is not authoritative and may be ignored or superseded. |
| Ships-to filter match | Yes | Discovery filter result | Does not prove final shipping cost, eligibility, or delivery time. |
| Final shipping charge/date | No | Unknown | Requires merchant cart/checkout calculation. |
| Tax | No | Unknown | Requires transactional context. |
| Stock quantity | No | Unknown | Only boolean availability was observed. |
| Technical compatibility | No reliable fact | Unknown | Inferred specifications must not be treated as compatibility proof. |
| Final payable total | No | Unknown until handoff | Checkout is authoritative. |

## Safe future CoSource derivations

These could be calculated from preserved source facts but were not implemented in Pass 1:

- Minor-to-major currency display using ISO 4217 exponent rules.
- Price deltas only between comparable offers in the same currency, or with an explicitly sourced FX conversion.
- Counts of offers, sellers, and available variants in a returned cluster.
- Normalized option-set intersections while retaining source variant IDs.
- Unit arithmetic only when a trustworthy quantity/unit fact exists.

Derived values must record inputs, time, currency, method, and uncertainty. CoSource must not relabel Shopify-inferred text as merchant fact.

## Provenance requirements implied by evidence

For every useful fact, later architecture needs provider, capture time, product cluster ID, offer/variant ID where applicable, seller ID, context and filters, source classification, and any message/disclosure targeting the field. Raw payload retention should be minimized; normalized facts should retain enough references for revalidation.
