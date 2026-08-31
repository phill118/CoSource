import { describe, expect, it, vi } from 'vitest'
import type { CatalogProvider } from '../../src/commerce/providers/catalog-provider'
import { CommerceProviderError } from '../../src/commerce/providers/errors'
import { createCatalogGateway, MAX_REQUEST_BODY_BYTES } from './gateway'

const searchResult = {
  products: [],
  messages: [],
  pagination: { hasMore: false },
}
const lookupResult = { products: [], missingIds: [], messages: [] }
const productResult = {
  product: {
    identity: { provider: 'shopify_global_catalog' as const, id: 'gid://shopify/p/abc' },
    title: {
      value: 'Canonical notebook',
      provenance: { kind: 'provider_explicit' as const },
    },
    media: [],
    offers: [],
    offerCompleteness: 'selection_scoped' as const,
    provenance: { kind: 'provider_explicit' as const },
  },
  selectedOptions: [],
  messages: [],
}

function fakeProvider(): CatalogProvider {
  return {
    search: vi.fn().mockResolvedValue(searchResult),
    lookup: vi.fn().mockResolvedValue(lookupResult),
    getProduct: vi.fn().mockResolvedValue(productResult),
  }
}

function request(path: string, body: unknown, overrides = {}) {
  return {
    method: 'POST',
    path,
    contentType: 'application/json',
    body: JSON.stringify(body),
    ...overrides,
  }
}

describe('catalog gateway success contracts', () => {
  it('returns canonical search data and canonical provider input', async () => {
    const provider = fakeProvider()
    const response = await createCatalogGateway(provider)(
      request('/api/catalog/search', {
        query: 'notebook',
        country: 'GB',
        currency: 'GBP',
        limit: 2,
        available: true,
        shipsTo: 'GB',
        maximumPrice: { minorAmount: 2000, currency: 'GBP' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(JSON.parse(response.body)).toEqual({ ok: true, data: searchResult })
    expect(provider.search).toHaveBeenCalledWith({
      query: 'notebook',
      context: { country: 'GB', language: undefined, currency: 'GBP' },
      pageSize: 2,
      cursor: undefined,
      filters: {
        available: true,
        shipsToCountry: 'GB',
        maximumPrice: { minorAmount: 2000, currency: 'GBP' },
      },
    })
  })

  it('returns canonical lookup data', async () => {
    const provider = fakeProvider()
    const response = await createCatalogGateway(provider)(
      request('/api/catalog/lookup', {
        ids: [{ type: 'variant', value: 'gid://shopify/ProductVariant/123' }],
      }),
    )

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ ok: true, data: lookupResult })
    expect(provider.lookup).toHaveBeenCalledOnce()
  })

  it('returns canonical product details and selections', async () => {
    const provider = fakeProvider()
    const response = await createCatalogGateway(provider)(
      request('/api/catalog/product', {
        productId: 'gid://shopify/p/abc',
        selectedOptions: [{ name: 'Color', value: 'Blue' }],
      }),
    )

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ ok: true, data: productResult })
    expect(provider.getProduct).toHaveBeenCalledOnce()
  })
})

describe('catalog gateway validation and security', () => {
  it('rejects malformed JSON, unsupported media, and oversized bodies', async () => {
    const handle = createCatalogGateway(fakeProvider())
    expect(
      (await handle({ ...request('/api/catalog/search', {}), body: '{' })).status,
    ).toBe(400)
    expect(
      (
        await handle({
          ...request('/api/catalog/search', {}),
          contentType: 'text/plain',
        })
      ).status,
    ).toBe(415)
    expect(
      (
        await handle({
          ...request('/api/catalog/search', {}),
          body: 'x'.repeat(MAX_REQUEST_BODY_BYTES + 1),
        })
      ).status,
    ).toBe(413)
  })

  it.each([
    {},
    { query: 'x'.repeat(501) },
    { query: 'book', country: 'GBR' },
    { query: 'book', currency: 'gbp' },
    {
      ids: Array.from({ length: 51 }, (_, index) => ({
        type: 'variant',
        value: `gid://shopify/ProductVariant/${index + 1}`,
      })),
    },
  ])('rejects invalid bounded input case %#', async (body) => {
    const path = 'ids' in body ? '/api/catalog/lookup' : '/api/catalog/search'
    const response = await createCatalogGateway(fakeProvider())(request(path, body))
    expect(response.status).toBe(400)
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it.each([
    { query: 'book', endpoint: 'https://attacker.test' },
    { query: 'book', url: 'https://attacker.test' },
    { query: 'book', profile: 'https://attacker.test/profile' },
    { query: 'book', provider: 'arbitrary' },
    { query: 'book', tool: 'raw_tool' },
    { query: 'book', jsonrpc: '2.0', method: 'tools/call' },
    { query: 'book', headers: { authorization: 'secret' } },
  ])('rejects open-proxy and provider-control fields', async (body) => {
    const provider = fakeProvider()
    const response = await createCatalogGateway(provider)(
      request('/api/catalog/search', body),
    )
    expect(response.status).toBe(400)
    expect(provider.search).not.toHaveBeenCalled()
  })

  it('rejects arbitrary routes and methods', async () => {
    const handle = createCatalogGateway(fakeProvider())
    expect((await handle(request('/api/proxy', {}))).status).toBe(404)
    expect(
      (await handle(request('/api/catalog/search', {}, { method: 'GET' }))).status,
    ).toBe(405)
  })
})

describe('catalog gateway safe error mapping', () => {
  it.each([
    ['invalid_request', 400, 'invalid_request'],
    ['transport', 502, 'provider_unavailable'],
    ['invalid_response', 502, 'invalid_provider_response'],
    ['provider_error', 502, 'provider_error'],
  ] as const)('maps provider %s safely', async (kind, status, code) => {
    const provider = fakeProvider()
    vi.mocked(provider.search).mockRejectedValue(
      new CommerceProviderError(kind, 'raw upstream detail'),
    )
    const response = await createCatalogGateway(provider)(
      request('/api/catalog/search', { query: 'book' }),
    )

    expect(response.status).toBe(status)
    expect(JSON.parse(response.body).error.code).toBe(code)
    expect(response.body).not.toContain('raw upstream detail')
    expect(response.body).not.toContain('stack')
  })

  it('maps throttling and preserves only a safe retry hint', async () => {
    const provider = fakeProvider()
    vi.mocked(provider.search).mockRejectedValue(
      new CommerceProviderError('throttled', 'raw detail', {
        retryAfterSeconds: 9,
      }),
    )
    const response = await createCatalogGateway(provider)(
      request('/api/catalog/search', { query: 'book' }),
    )

    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toBe('9')
    expect(JSON.parse(response.body).error).toEqual({
      code: 'provider_throttled',
      message: 'The catalog is temporarily busy',
      retryAfterSeconds: 9,
    })
  })

  it('maps unexpected exceptions to a generic 500 response', async () => {
    const provider = fakeProvider()
    vi.mocked(provider.search).mockRejectedValue(new Error('secret stack detail'))
    const response = await createCatalogGateway(provider)(
      request('/api/catalog/search', { query: 'book' }),
    )

    expect(response.status).toBe(500)
    expect(response.body).toBe(
      JSON.stringify({
        ok: false,
        error: {
          code: 'internal_error',
          message: 'The request could not be completed',
        },
      }),
    )
  })
})
