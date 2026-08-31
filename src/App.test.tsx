// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import App from './App'

const provenance = { kind: 'provider_explicit', provider: 'shopify_global_catalog' }
function product(id: string, title: string, currency = 'GBP', merchant = 'Merchant One') {
  return { identity: { provider: 'shopify_global_catalog', id }, title: { value: title, provenance }, description: { value: 'Provider-created description', provenance: { ...provenance, kind: 'provider_inferred' } }, media: [], featuredOfferId: `${id}-offer`, offerCompleteness: 'featured_only', provenance,
    offers: [{ identity: { provider: 'shopify_global_catalog', id: `${id}-offer` }, title: { value: title, provenance }, merchant: { name: merchant, provenance }, productUrl: 'https://merchant.test/product', handoffUrl: 'https://merchant.test/cart', price: { minorAmount: 2499, currency }, availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance }] }
}
const ok = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('product discovery UI', () => {
  it('validates empty queries locally', async () => {
    render(<App />); await userEvent.click(screen.getByRole('button', { name: 'Search products' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a product')
  })
  it('submits, shows loading, and renders real-shape facts honestly', async () => {
    let resolve!: (value: Response) => void; vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => { resolve = done })))
    render(<App />); await userEvent.type(screen.getByLabelText('What are you looking for?'), '  backpack  '); await userEvent.click(screen.getByRole('button', { name: 'Search products' }))
    expect(screen.getByText('Searching the live catalog…')).toBeInTheDocument()
    resolve(await ok({ products: [product('p1', 'Canvas Backpack')], messages: [], pagination: { hasMore: false } }))
    expect(await screen.findByText('Canvas Backpack')).toBeInTheDocument(); expect(screen.getByText('GBP 24.99')).toBeInTheDocument(); expect(screen.getByText('Inferred details')).toBeInTheDocument(); expect(screen.getByText('Listed as available')).toBeInTheDocument(); expect(screen.getByText(/More offers may be available/)).toBeInTheDocument()
  })
  it('calls an offer featured only when canonical evidence identifies it', async () => {
    const withoutEvidence = product('p1', 'Unranked Bag')
    delete (withoutEvidence as { featuredOfferId?: string }).featuredOfferId
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(await ok({ products: [withoutEvidence], messages: [], pagination: { hasMore: false } })))
    render(<App />); const input = screen.getByLabelText('What are you looking for?'); await userEvent.type(input, 'bag'); fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Returned offer')).toBeInTheDocument()
    expect(screen.queryByText('Featured offer')).not.toBeInTheDocument()
  })
  it('renders empty and safe error states', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(await ok({ products: [], messages: [], pagination: { hasMore: false } })).mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: 'provider_throttled', message: 'raw', retryAfterSeconds: 5 } }), { status: 429 }))
    vi.stubGlobal('fetch', fetch); render(<App />); const input = screen.getByLabelText('What are you looking for?'); await userEvent.type(input, 'nothing'); fireEvent.submit(input.closest('form')!); expect(await screen.findByText('No matching products returned')).toBeInTheDocument(); await userEvent.clear(input); await userEvent.type(input, 'again'); fireEvent.submit(input.closest('form')!); expect(await screen.findByText(/Try again in about 5 seconds/)).toBeInTheDocument()
  })
  it('appends cursor pagination and resets it for a new search', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(await ok({ products: [product('p1','First')], messages: [], pagination: { hasMore: true, cursor: 'next-1' } })).mockResolvedValueOnce(await ok({ products: [product('p2','Second')], messages: [], pagination: { hasMore: false } })).mockResolvedValueOnce(await ok({ products: [product('p3','Fresh')], messages: [], pagination: { hasMore: false } })); vi.stubGlobal('fetch', fetch)
    render(<App />); const input = screen.getByLabelText('What are you looking for?'); await userEvent.type(input,'lamp'); fireEvent.submit(input.closest('form')!); await screen.findByText('First'); await userEvent.click(screen.getByRole('button',{name:'Load more products'})); expect(await screen.findByText('Second')).toBeInTheDocument(); expect(screen.getByText('First')).toBeInTheDocument(); expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject({ cursor:'next-1' }); await userEvent.clear(input); await userEvent.type(input,'notebook'); fireEvent.submit(input.closest('form')!); await screen.findByText('Fresh'); expect(screen.queryByText('First')).not.toBeInTheDocument()
  })
  it('opens richer detail with unranked mixed-currency offers and safe links', async () => {
    const searchProduct = product('p1','Travel Bag'); const detailProduct = { ...searchProduct, offers: [searchProduct.offers[0], product('p2','Travel Bag','USD','Merchant Two').offers[0]] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(await ok({ products:[searchProduct],messages:[],pagination:{hasMore:false} })).mockResolvedValueOnce(await ok({ product:detailProduct,selectedOptions:[],messages:[] })))
    render(<App />); const input=screen.getByLabelText('What are you looking for?'); await userEvent.type(input,'bag'); fireEvent.submit(input.closest('form')!); await userEvent.click(await screen.findByRole('button',{name:'View product and offers'})); expect(await screen.findByText('2 merchant offers')).toBeInTheDocument(); expect(screen.getAllByText('GBP 24.99').length).toBeGreaterThan(0); expect(screen.getByText('USD 24.99')).toBeInTheDocument(); expect(screen.queryByText(/recommended merchant|best deal/i)).not.toBeInTheDocument(); await waitFor(() => expect(screen.getAllByRole('link',{name:'View on merchant site'})[0]).toHaveAttribute('rel','noopener noreferrer'))
  })
})
