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
  it('keeps the human UI available when WebMCP is unsupported',()=>{render(<App/>);expect(screen.getByText('WebMCP unavailable in this browser')).toBeInTheDocument();expect(screen.getByText('Purchase goal')).toBeInTheDocument()})
  it('shows real registration and invocation activity with a model context',async()=>{const registered:Array<{tool:WebMCPToolDefinition;signal?:AbortSignal}>=[];const modelContext=Object.assign(new EventTarget(),{async registerTool(tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}){registered.push({tool,signal:options?.signal})}});Object.defineProperty(document,'modelContext',{configurable:true,value:modelContext});try{render(<App/>);expect(await screen.findByText('WebMCP ready')).toBeInTheDocument();expect(screen.getByText('7 read-only tools available. No agent connection is implied.')).toBeInTheDocument();const tool=registered.find(item=>item.tool.name==='get_purchase_plan')!.tool;await tool.execute({});expect(await screen.findByText('get_purchase_plan')).toBeInTheDocument();expect(screen.getByText(/success: Read completed/)).toBeInTheDocument();cleanup();expect(registered.every(item=>item.signal?.aborted)).toBe(true)}finally{delete (document as Document&{modelContext?:WebMCPModelContext}).modelContext}})
  it('builds and edits one transparent structured purchase goal', async () => {
    render(<App />)
    const summary = screen.getByLabelText('What are you trying to buy or achieve?')
    await userEvent.type(summary, 'Six office chairs')
    await userEvent.type(screen.getByLabelText('Quantity optional'), '6')
    await userEvent.type(screen.getByLabelText('Budget amount'), '800')
    await userEvent.click(screen.getByRole('button', { name: 'Add hard requirement' }))
    await userEvent.type(screen.getByLabelText('Must have 1 value'), 'adjustable arms')
    await userEvent.click(screen.getByRole('button', { name: 'Add preference' }))
    await userEvent.type(screen.getByLabelText('Prefer 1 value'), 'black')
    await userEvent.click(screen.getByRole('button', { name: 'Add exclusion' }))
    await userEvent.type(screen.getByLabelText('Exclude 1 value'), 'leather')
    expect(screen.getByText('6 × Six office chairs')).toBeInTheDocument()
    expect(screen.getByText('GBP 800.00')).toBeInTheDocument()
    expect(screen.getByText('adjustable arms')).toBeInTheDocument(); expect(screen.getByText('black')).toBeInTheDocument(); expect(screen.getByText('leather')).toBeInTheDocument()
    expect(screen.getByText(/Revision [1-9]/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove preference 1' }))
    expect(screen.queryByText('black')).not.toBeInTheDocument()
    expect(screen.queryByText(/product matches|fit score|recommended product/i)).not.toBeInTheDocument()
  })
  it('copies the literal goal summary into keyword search without interpreting it', async () => {
    render(<App />); const summary = screen.getByLabelText('What are you trying to buy or achieve?'); await userEvent.type(summary, 'waterproof backpack for a laptop'); await userEvent.click(screen.getByRole('button', { name: 'Use goal summary as search' }))
    expect(screen.getByLabelText('What are you looking for?')).toHaveValue('waterproof backpack for a laptop')
  })
  it('defaults budget currency to GBP and accepts a real supported currency outside the former shortlist', async () => {
    render(<App />); expect(screen.getByLabelText('Budget currency')).toHaveValue('GBP'); await userEvent.type(screen.getByLabelText('What are you trying to buy or achieve?'), 'Office supplies')
    await userEvent.type(screen.getByLabelText('Budget amount'), '25')
    await userEvent.clear(screen.getByLabelText('Budget currency')); await userEvent.type(screen.getByLabelText('Budget currency'), 'AUD')
    expect(screen.getByText('AUD 25.00')).toBeInTheDocument()
  })
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
    expect(screen.getByText('Complete a valid purchase goal to evaluate this product.')).toBeInTheDocument()
  })
  it('renders deterministic evidence evaluation only for a valid goal', async () => {
    const searchProduct = product('p1','Black Bag'); const detailProduct = { ...searchProduct, attributes: { value:[{name:'Colour',value:'Black'}], provenance } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(await ok({products:[searchProduct],messages:[],pagination:{hasMore:false}})).mockResolvedValueOnce(await ok({product:detailProduct,selectedOptions:[],messages:[]})))
    render(<App />); await userEvent.type(screen.getByLabelText('What are you trying to buy or achieve?'),'A black bag'); await userEvent.click(screen.getByRole('button',{name:'Add hard requirement'})); await userEvent.selectOptions(screen.getByLabelText('Must have 1 operator'),'equals'); await userEvent.type(screen.getByLabelText('Must have 1 field'),'colour'); await userEvent.type(screen.getByLabelText('Must have 1 value'),'black')
    const input=screen.getByLabelText('What are you looking for?'); await userEvent.type(input,'bag'); fireEvent.submit(input.closest('form')!); await userEvent.click(await screen.findByRole('button',{name:'View product and offers'})); expect(await screen.findByText('Eligible')).toBeInTheDocument(); expect(screen.getByText('Provided field "Colour" is "Black".')).toBeInTheDocument(); expect(screen.queryByText(/match score|best match|top pick/i)).not.toBeInTheDocument()
  })
  it('compares two products and keeps a revisioned human-owned plan', async () => {
    const first=product('p1','First Bag'),second=product('p2','Second Bag')
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(await ok({products:[first,second],messages:[],pagination:{hasMore:false}})))
    render(<App/>);await userEvent.type(screen.getByLabelText('What are you trying to buy or achieve?'),'A bag');await userEvent.type(screen.getByLabelText('Budget amount'),'30.00');const input=screen.getByLabelText('What are you looking for?');await userEvent.type(input,'bag');fireEvent.submit(input.closest('form')!);const compareButtons=await screen.findAllByRole('button',{name:'Select for comparison'});await userEvent.click(compareButtons[0]!);await userEvent.click(compareButtons[1]!);expect(screen.getByText('Equivalent on known evidence')).toBeInTheDocument();const addButtons=screen.getAllByRole('button',{name:'Add to purchase plan'});await userEvent.click(addButtons[0]!);expect(screen.getByText(/Plan revision 1/)).toBeInTheDocument();expect(screen.getByText('Plan budget: satisfied')).toBeInTheDocument();expect(screen.getByText('Known item-price subtotal is within the GBP budget.')).toBeInTheDocument();expect(screen.getByText('Known item-price subtotals')).toBeInTheDocument();await userEvent.type(screen.getByLabelText('What are you trying to buy or achieve?'),' updated');expect(screen.getByRole('alert')).toHaveTextContent('goal changed');await userEvent.click(screen.getByRole('button',{name:'Remove'}));expect(screen.getByText('No products added. Compare candidates or add one from search.')).toBeInTheDocument();expect(screen.queryByText(/\d+%|recommended|top pick/i)).not.toBeInTheDocument()
  })
  it('retains canonical plan evidence across multiple unrelated searches', async () => {
    const a=product('a','Retained A'),aPeer=product('a-peer','A Peer'),b=product('b','Retained B'),bPeer=product('b-peer','B Peer'),third=product('third','Third Result')
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(await ok({products:[a,aPeer],messages:[],pagination:{hasMore:false}})).mockResolvedValueOnce(await ok({products:[b,bPeer],messages:[],pagination:{hasMore:false}})).mockResolvedValueOnce(await ok({products:[third],messages:[],pagination:{hasMore:false}})))
    render(<App/>);await userEvent.type(screen.getByLabelText('What are you trying to buy or achieve?'),'A multi-search plan');const input=screen.getByLabelText('What are you looking for?')
    await userEvent.type(input,'category a');fireEvent.submit(input.closest('form')!);let compare=await screen.findAllByRole('button',{name:'Select for comparison'});await userEvent.click(compare[0]!);await userEvent.click(compare[1]!);await userEvent.click(screen.getAllByRole('button',{name:'Add to purchase plan'})[0]!);expect(screen.getAllByText('Retained A').length).toBeGreaterThan(1)
    await userEvent.clear(input);await userEvent.type(input,'category b');fireEvent.submit(input.closest('form')!);compare=await screen.findAllByRole('button',{name:'Select for comparison'});await userEvent.click(compare[0]!);await userEvent.click(compare[1]!);await userEvent.click(screen.getAllByRole('button',{name:'Add to purchase plan'})[0]!);expect(screen.getByText(/Plan revision 2/)).toBeInTheDocument();expect(screen.getByText('Retained A')).toBeInTheDocument();expect(screen.getAllByText('Retained B').length).toBeGreaterThan(1)
    await userEvent.clear(input);await userEvent.type(input,'category c');fireEvent.submit(input.closest('form')!);await screen.findByText('Third Result');expect(screen.getByText('Retained A')).toBeInTheDocument();expect(screen.getByText('Retained B')).toBeInTheDocument();expect(screen.getByText('GBP 49.98')).toBeInTheDocument()
  })
})
