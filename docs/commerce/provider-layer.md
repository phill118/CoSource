# Commerce provider layer

Pass 2 implements data access and normalization. Pass 3 exposes it through a server-side canonical gateway; product search is still not exposed in the UI.

## Ownership

- `src/commerce/domain`: provider-independent products, offers, merchants, money, evidence, media, messages, and pagination.
- `src/commerce/providers/catalog-provider.ts`: the canonical `search`, `lookup`, and `getProduct` contract.
- `src/commerce/providers/shopify-global`: fixed-endpoint Shopify JSON-RPC transport, narrow Zod schemas, and canonical mapping.

Raw UCP envelopes and Shopify field names do not leave the Shopify adapter.

## Trust

Evidence uses categorical states: `provider_explicit`, `provider_inferred`, `cosource_derived`, and `unknown`. Shopify-inferred product descriptions, normalized options, attributes, specifications, features, selling points, and conditions are mapped as inferred. Variant description provenance remains unknown because Pass 1 did not establish its author.

Inferred Shopify attributes are normalized from validated `{name, value}` string pairs into the provider-independent `ProductAttribute` shape. Malformed attribute entries invalidate the remote product response; additional provider fields are not carried into the canonical domain.

Remote text is retained as plain untrusted data. Only validated HTTPS URLs become canonical media, product, seller, policy, or handoff links.

## Money

`Money` stores an exact safe-integer `minorAmount` and mandatory three-letter currency. The adapter performs no display conversion, FX conversion, ranking, or cross-currency arithmetic. A same-currency assertion rejects mixed-currency arithmetic unless a future explicit FX source exists. Country context and currency remain separate hints.

## Completeness and unknowns

Search products are marked `featured_only`; they must not be treated as exhaustive seller sets. Lookup is marked `provider_returned_unknown`, while product detail is `selection_scoped`. Additional lookup/product-detail calls can reveal more offers without proving global exhaustiveness.

`featuredOfferId` is set only when exactly one returned offer has an explicit `featured` lookup correlation. Array order is not evidence. No featured correlation, or conflicting featured correlations on multiple offers, leaves the field undefined without reordering or ranking offers.

The model deliberately has no shipping cost, delivery date, tax, stock quantity, compatibility, or final-total fields. Catalog availability is represented as an observed catalog signal, not inventory or a transaction guarantee.

## Configuration and transport

The Shopify endpoint has one fixed owner. Construction requires a controlled HTTPS agent-profile URL and optionally accepts a bounded timeout and injected `fetch` implementation. Requests have bounded inputs, increasing JSON-RPC IDs, abort timeouts, no automatic retries, and safe error categories. HTTP 429 retains numeric `Retry-After` seconds where supplied.

The current endpoint did not accept the Pass 2 browser CORS preflight. Pass 3 therefore routes the future browser through same-origin `/api/catalog/*` handlers into this provider. The gateway contains no Shopify mapping or raw protocol logic. Server-only profile configuration remains outside the client bundle.
