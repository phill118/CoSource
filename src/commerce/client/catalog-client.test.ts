import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogClient, CatalogClientError, type ProductRequest } from './catalog-client'

const provenance = { kind: 'provider_explicit', provider: 'shopify_global_catalog' }
const product = {
  identity: { provider: 'shopify_global_catalog', id: 'gid://shopify/p/abc' }, title: { value: 'Canvas Backpack', provenance },
  description: { value: 'A practical bag', provenance: { ...provenance, kind: 'provider_inferred' } }, media: [], featuredOfferId: 'offer-1', offerCompleteness: 'featured_only', provenance,
  offers: [{ identity: { provider: 'shopify_global_catalog', id: 'offer-1' }, title: { value: 'Canvas Backpack', provenance }, merchant: { name: 'Merchant One', provenance }, price: { minorAmount: 3999, currency: 'GBP' }, availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance }],
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const productRequest:ProductRequest={product:{provider:'shopify_global_catalog',id:product.identity.id},country:'US',currency:'USD'}
afterEach(() => vi.unstubAllGlobals())

describe('catalog client', () => {
  it('searches through the same-origin canonical gateway', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ok: true, data: { products: [product], messages: [], pagination: { hasMore: false } } }))
    vi.stubGlobal('fetch', fetch)
    const result = await catalogClient.search({ query: 'backpack', country: 'GB', currency: 'GBP' })
    expect(result.products[0]?.title.value).toBe('Canvas Backpack')
    expect(fetch).toHaveBeenCalledWith('/api/catalog/search', expect.objectContaining({ method: 'POST' }))
  })
  it('sends bounded canonical sourcing fields without provider internals',async()=>{const fetch=vi.fn().mockResolvedValue(response({ok:true,data:{products:[],messages:[],pagination:{hasMore:false}}}));vi.stubGlobal('fetch',fetch);await catalogClient.search({query:'coats',country:'GB',currency:'GBP',intent:'students',available:true,shipsTo:'GB',maximumPrice:{minorAmount:3000,currency:'GBP'},condition:'new',attributes:[{name:'Color',values:['Blue']}],view:'offer'});const body=JSON.parse(fetch.mock.calls[0]![1].body);expect(body).toMatchObject({query:'coats',maximumPrice:{minorAmount:3000,currency:'GBP'},condition:'new',attributes:[{name:'Color',values:['Blue']}],view:'offer'});expect(body).not.toHaveProperty('endpoint')})
  it('loads product detail', async () => {
    const fetch=vi.fn().mockResolvedValue(response({ ok: true, data: { product, selectedOptions: [], messages: [] } }))
    vi.stubGlobal('fetch',fetch)
    expect((await catalogClient.product(productRequest)).product.offers).toHaveLength(1)
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({productId:product.identity.id,country:'US',currency:'USD'})
  })
  it('preserves safe throttling information', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, error: { code: 'provider_throttled', message: 'Busy', retryAfterSeconds: 8 } }, 429)))
    await expect(catalogClient.search({ query: 'bag', country: 'GB', currency: 'GBP' })).rejects.toMatchObject({ code: 'provider_throttled', retryAfterSeconds: 8 })
  })
  it('rejects malformed success responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, data: { raw: 'json-rpc' } })))
    await expect(catalogClient.search({ query: 'bag', country: 'GB', currency: 'GBP' })).rejects.toMatchObject({ code: 'malformed_response' })
  })
  it('maps unreadable and network failures safely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json')))
    await expect(catalogClient.product(productRequest)).rejects.toBeInstanceOf(CatalogClientError)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private detail')))
    await expect(catalogClient.product(productRequest)).rejects.toMatchObject({ code: 'network_error' })
  })
})
