import { describe, expect, it, vi } from 'vitest'
import pass1Fixture from '../../../../docs/discovery/fixtures/global-catalog-structural-excerpt.json'
import { createMoney } from '../../domain/money'
import { CommerceProviderError } from '../errors'
import { mapProduct } from './mapping'
import { productSchema } from './schemas'
import { ShopifyGlobalCatalogProvider } from './shopify-global-catalog-provider'

const profile = 'https://example.test/.well-known/ucp'

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function envelope(structuredContent: unknown): unknown {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: { structuredContent },
  }
}

function rawProduct() {
  return {
    id: 'gid://shopify/p/cluster1',
    title: 'Trail sock',
    description: { plain: 'Normalized product description' },
    options: [
      {
        name: 'Size',
        values: [{ label: 'M', available: true, exists: true }],
      },
    ],
    metadata: {
      attributes: [{ name: 'Material', value: 'Wool', shopify_only: 'discard me' }],
      tech_specs: 'Material: wool',
      top_features: ['Cushioned'],
      unique_selling_points: ['Long wearing'],
    },
    media: [
      { type: 'image', url: 'https://cdn.example.test/sock.jpg', alt_text: 'Sock' },
      { type: 'image', url: 'javascript:alert(1)', alt_text: 'Unsafe' },
    ],
    variants: [
      {
        id: 'gid://shopify/ProductVariant/100',
        title: 'Trail sock M',
        description: { plain: 'Merchant copy' },
        url: 'https://merchant-one.test/products/sock',
        checkout_url: 'https://merchant-one.test/cart/100:1',
        price: { amount: 2900, currency: 'GBP' },
        availability: { available: true },
        options: [{ name: 'Size', label: 'M' }],
        condition: ['new'],
        eligible: { native_checkout: false },
        seller: {
          id: 'gid://shopify/Shop/1',
          name: 'Merchant One',
          domain: 'merchant-one.myshopify.com',
          url: 'https://merchant-one.test',
          links: [
            { type: 'privacy_policy', url: 'https://merchant-one.test/privacy' },
          ],
        },
        inputs: [{ id: 'gid://shopify/p/cluster1', match: 'featured' }],
      },
      {
        id: 'gid://shopify/ProductVariant/200',
        title: 'Trail sock M second offer',
        url: 'http://unsafe.example.test/product',
        checkout_url: 'data:text/html,bad',
        price: { amount: 3500, currency: 'USD' },
        availability: {},
        options: [{ name: 'Size', label: 'M' }],
        seller: { id: 'gid://shopify/Shop/2', name: 'Merchant Two' },
        inputs: [{ id: 'gid://shopify/ProductVariant/200', match: 'exact' }],
      },
    ],
    selected: [{ name: 'Size', label: 'M' }],
  }
}

function providerFor(body: unknown, status = 200, headers?: HeadersInit) {
  const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
    jsonResponse(body, status, headers),
  )
  return {
    provider: new ShopifyGlobalCatalogProvider({
      agentProfileUrl: profile,
      fetchImplementation,
    }),
    fetchImplementation,
  }
}

describe('ShopifyGlobalCatalogProvider mapping', () => {
  it('uses the sanitized Pass 1 fixture without weakening required-field validation', () => {
    expect(productSchema.safeParse(pass1Fixture.lookup_excerpt.product).success).toBe(false)

    const completeFixture = {
      ...pass1Fixture.lookup_excerpt.product,
      variants: pass1Fixture.lookup_excerpt.product.variants.map((variant, index) => ({
        ...variant,
        title: `Controlled fixture offer ${index + 1}`,
      })),
    }
    const parsed = productSchema.parse(completeFixture)
    const product = mapProduct(parsed, 'provider_returned_unknown')

    expect(product.offers).toHaveLength(2)
    expect(product.offers.map((offer) => offer.merchant?.name)).toEqual([
      'Tootsies Rockridge & Crush on College',
      'Darn Tough UK',
    ])
    expect(product.offers[1]?.correlations.map((item) => item.match)).toEqual([
      'featured',
      'exact',
    ])
  })

  it('maps search into a non-exhaustive canonical cluster with preserved currencies', async () => {
    const { provider, fetchImplementation } = providerFor(
      envelope({
        ucp: { version: '2026-04-08', status: 'success' },
        products: [rawProduct()],
        messages: [
          { type: 'info', code: 'price_filter_applied', content: 'Converted filter' },
        ],
        pagination: { cursor: 'next', has_next_page: true, total_count: 410 },
      }),
    )

    const result = await provider.search({
      query: 'trail socks',
      context: { country: 'GB', currency: 'GBP' },
      pageSize: 2,
      filters: { available: true, shipsToCountry: 'GB' },
    })

    expect(result.products[0]?.offerCompleteness).toBe('featured_only')
    expect(result.products[0]?.offers.map((offer) => offer.price.currency)).toEqual([
      'GBP',
      'USD',
    ])
    expect(result.products[0]?.offers[0]?.availability).toMatchObject({
      state: 'available',
      basis: 'catalog_signal',
    })
    expect(result.products[0]?.offers[1]?.availability.state).toBe('unknown')
    expect(result.pagination).toEqual({
      cursor: 'next',
      hasMore: true,
      estimatedTotal: 410,
    })
    expect(result.messages[0]).toMatchObject({
      level: 'info',
      code: 'price_filter_applied',
    })

    const request = JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body))
    expect(request.params.arguments.catalog.context).toEqual({
      address_country: 'GB',
      currency: 'GBP',
    })
    expect(request.params.arguments.meta['ucp-agent'].profile).toBe(profile)
  })

  it('keeps inferred facts separate from explicit and unknown facts', async () => {
    const { provider } = providerFor(
      envelope({
        ucp: { version: '2026-04-08' },
        products: [rawProduct()],
      }),
    )
    const product = (await provider.search({ query: 'sock' })).products[0]

    expect(product?.title.provenance.kind).toBe('provider_explicit')
    expect(product?.description?.provenance.kind).toBe('provider_inferred')
    expect(product?.options?.provenance.kind).toBe('provider_inferred')
    expect(product?.attributes).toEqual({
      value: [{ name: 'Material', value: 'Wool' }],
      provenance: {
        kind: 'provider_inferred',
        provider: 'shopify_global_catalog',
        sourcePath: 'metadata.attributes',
      },
    })
    expect(product?.attributes?.value[0]).not.toHaveProperty('shopify_only')
    expect(product?.technicalSpecifications?.provenance.kind).toBe('provider_inferred')
    expect(product?.offers[0]?.condition?.provenance.kind).toBe('provider_inferred')
    expect(product?.offers[0]?.description?.provenance.kind).toBe('unknown')
  })

  it('drops non-HTTPS actionable URLs and does not manufacture unknown commerce facts', async () => {
    const { provider } = providerFor(
      envelope({ ucp: { version: '2026-04-08' }, products: [rawProduct()] }),
    )
    const product = (await provider.search({ query: 'sock' })).products[0]
    const unsafeOffer = product?.offers[1]

    expect(product?.media).toHaveLength(1)
    expect(unsafeOffer?.productUrl).toBeUndefined()
    expect(unsafeOffer?.handoffUrl).toBeUndefined()
    expect(unsafeOffer).not.toHaveProperty('shippingCost')
    expect(unsafeOffer).not.toHaveProperty('deliveryDate')
    expect(unsafeOffer).not.toHaveProperty('tax')
    expect(unsafeOffer).not.toHaveProperty('stockQuantity')
    expect(product).not.toHaveProperty('technicalCompatibility')
    expect(product).not.toHaveProperty('finalPayableTotal')
  })

  it('maps lookup correlation and missing identifiers separately from failure', async () => {
    const product = rawProduct()
    const missing = 'gid://shopify/ProductVariant/999999999999999'
    const { provider } = providerFor(
      envelope({
        ucp: { version: '2026-04-08' },
        products: [product],
        messages: [{ type: 'info', code: 'not_found', content: missing }],
      }),
    )

    const result = await provider.lookup([
      { type: 'product', value: product.id },
      { type: 'variant', value: 'gid://shopify/ProductVariant/200' },
    ])

    expect(result.missingIds).toEqual([missing])
    expect(result.products[0]?.offers[1]?.correlations[0]).toEqual({
      inputId: 'gid://shopify/ProductVariant/200',
      match: 'exact',
    })
  })

  it('returns multiple merchants and selected options from getProduct without ranking', async () => {
    const { provider } = providerFor(
      envelope({ ucp: { version: '2026-04-08' }, product: rawProduct() }),
    )

    const result = await provider.getProduct({
      productId: 'gid://shopify/p/cluster1',
      selectedOptions: [{ name: 'Size', value: 'M' }],
    })

    expect(result.product.offerCompleteness).toBe('selection_scoped')
    expect(result.product.offers.map((offer) => offer.merchant?.name)).toEqual([
      'Merchant One',
      'Merchant Two',
    ])
    expect(result.selectedOptions).toEqual([{ name: 'Size', value: 'M' }])
  })

  it('derives featured offer only from one explicit featured correlation', () => {
    const secondFeatured = rawProduct()
    secondFeatured.variants[0]!.inputs = [
      { id: secondFeatured.variants[0]!.id, match: 'exact' },
    ]
    secondFeatured.variants[1]!.inputs = [
      { id: secondFeatured.id, match: 'featured' },
    ]
    const mappedSecond = mapProduct(
      productSchema.parse(secondFeatured),
      'provider_returned_unknown',
    )

    expect(mappedSecond.featuredOfferId).toBe('gid://shopify/ProductVariant/200')
    expect(mappedSecond.offers.map((offer) => offer.identity.id)).toEqual([
      'gid://shopify/ProductVariant/100',
      'gid://shopify/ProductVariant/200',
    ])

    const noFeatured = rawProduct()
    noFeatured.variants[0]!.inputs = []
    noFeatured.variants[1]!.inputs = [
      { id: noFeatured.variants[1]!.id, match: 'exact' },
    ]
    expect(
      mapProduct(productSchema.parse(noFeatured), 'provider_returned_unknown')
        .featuredOfferId,
    ).toBeUndefined()

    const ambiguousFeatured = rawProduct()
    ambiguousFeatured.variants[0]!.inputs = [
      { id: ambiguousFeatured.id, match: 'featured' },
    ]
    ambiguousFeatured.variants[1]!.inputs = [
      { id: ambiguousFeatured.id, match: 'featured' },
    ]
    expect(
      mapProduct(productSchema.parse(ambiguousFeatured), 'provider_returned_unknown')
        .featuredOfferId,
    ).toBeUndefined()
  })
})

describe('ShopifyGlobalCatalogProvider safety and errors', () => {
  it('rejects malformed provider content at runtime', async () => {
    const { provider } = providerFor(
      envelope({ ucp: { version: '2026-04-08' }, products: [{ id: 'missing-fields' }] }),
    )

    await expect(provider.search({ query: 'valid query' })).rejects.toMatchObject({
      kind: 'invalid_response',
    })
  })

  it('rejects malformed attributes instead of leaking raw structures', async () => {
    const malformed = rawProduct()
    malformed.metadata.attributes = [{ name: 'Material' }] as never
    const { provider } = providerFor(
      envelope({ ucp: { version: '2026-04-08' }, products: [malformed] }),
    )

    await expect(provider.search({ query: 'valid query' })).rejects.toMatchObject({
      kind: 'invalid_response',
    })
  })

  it('maps HTTP 422 without exposing its raw body', async () => {
    const { provider } = providerFor({ secret: 'do not leak' }, 422)
    await expect(provider.search({ query: 'valid' })).rejects.toEqual(
      expect.objectContaining({ kind: 'invalid_request', status: 422 }),
    )
  })

  it('preserves Retry-After for HTTP 429 without retrying', async () => {
    const { provider, fetchImplementation } = providerFor({}, 429, { 'Retry-After': '12' })
    await expect(provider.search({ query: 'valid' })).rejects.toMatchObject({
      kind: 'throttled',
      status: 429,
      retryAfterSeconds: 12,
    })
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
  })

  it.each([
    { jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'External detail' } },
    { jsonrpc: '2.0', id: 1, result: { isError: true, content: [] } },
  ])('maps JSON-RPC and tool application errors safely', async (body) => {
    const { provider } = providerFor(body)
    await expect(provider.search({ query: 'valid' })).rejects.toMatchObject({
      kind: 'provider_error',
      message: 'Shopify catalog tool reported an error',
    })
  })

  it('bounds requests and requires explicit matching price currency', async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
    const provider = new ShopifyGlobalCatalogProvider({
      agentProfileUrl: profile,
      fetchImplementation,
    })

    await expect(provider.search({ query: 'x'.repeat(501) })).rejects.toMatchObject({
      kind: 'invalid_request',
    })
    await expect(
      provider.search({
        query: 'lamp',
        context: { country: 'GB', currency: 'GBP' },
        filters: { maximumPrice: createMoney(1000, 'USD') },
      }),
    ).rejects.toMatchObject({ kind: 'invalid_request' })
    expect(fetchImplementation).not.toHaveBeenCalled()
  })

  it('requires a controlled HTTPS profile URL', () => {
    expect(
      () => new ShopifyGlobalCatalogProvider({ agentProfileUrl: 'http://unsafe.test' }),
    ).toThrow(CommerceProviderError)
  })
})
