import { useState } from 'react'
import './App.css'
import type { MerchantOffer, ProductCluster, ProvenanceKind } from './commerce/domain/commerce'
import type { CatalogProductResult } from './commerce/providers/catalog-provider'
import { catalogClient, CatalogClientError } from './commerce/client/catalog-client'
import { formatMoney, MoneyDisplayError } from './commerce/domain/money-display'
import { PurchaseGoalPanel } from './goals/PurchaseGoalPanel'
import { usePurchaseGoal } from './goals/use-purchase-goal'

const availabilityText = { available: 'Listed as available', unavailable: 'Unavailable', unknown: 'Availability not confirmed' }
const provenanceText: Record<ProvenanceKind, string> = { provider_explicit: 'Provided', provider_inferred: 'Inferred', cosource_derived: 'Derived', unknown: 'Unknown' }
function money(offer: MerchantOffer) {
  try { return formatMoney(offer.price) }
  catch (error) { return error instanceof MoneyDisplayError ? 'Price unavailable — unsupported currency' : 'Price unavailable' }
}
const safeExternal = (url?: string) => url?.startsWith('https://') ? url : undefined

function ProductImage({ product }: { product: ProductCluster }) {
  const [broken, setBroken] = useState(false); const image = product.media[0]
  return image && !broken ? <img src={image.url} alt={image.altText || product.title.value} loading="lazy" onError={() => setBroken(true)} /> : <div className="image-fallback">No image</div>
}

function ResultCard({ product, onOpen }: { product: ProductCluster; onOpen: () => void }) {
  const featured = product.featuredOfferId ? product.offers.find((offer) => offer.identity.id === product.featuredOfferId) : undefined
  const displayedOffer = featured ?? product.offers[0]
  return <article className="result-card"><ProductImage product={product} /><div className="card-copy">
    <div className="card-labels"><span>Product cluster</span>{product.description?.provenance.kind === 'provider_inferred' && <span className="evidence">Inferred details</span>}</div>
    <h3>{product.title.value}</h3>{product.description && <p className="description">{product.description.value}</p>}
    {displayedOffer ? <div className="featured"><span>{featured ? 'Featured offer' : 'Returned offer'}</span><strong>{money(displayedOffer)}</strong><span>{displayedOffer.merchant?.name || displayedOffer.merchant?.domain || 'Merchant not named'}</span><span>{availabilityText[displayedOffer.availability.state]}</span></div> : <p>No offer was returned for this cluster.</p>}
    <p className="completeness">More offers may be available. Open the product to check.</p><button type="button" className="secondary" onClick={onOpen}>View product and offers</button>
  </div></article>
}

function Detail({ result, loading, error, onClose }: { result?: CatalogProductResult; loading: boolean; error?: string; onClose: () => void }) {
  return <aside className="detail" aria-labelledby="detail-title" aria-live="polite"><div className="detail-head"><p className="eyebrow">Product detail</p><button type="button" className="quiet" onClick={onClose}>Close</button></div>
    {loading && <p role="status">Loading product and merchant offers…</p>}{error && <div className="notice error" role="alert">{error}</div>}
    {result && <><h2 id="detail-title">{result.product.title.value}</h2><p className="trust-note">Product information: {provenanceText[result.product.title.provenance.kind]}. Some descriptions and attributes are inferred by the commerce provider and may require verification.</p>
      {result.product.options?.value.length ? <div><h3>Product options</h3>{result.product.options.value.map((option) => <p key={option.name}><strong>{option.name}:</strong> {option.values.map((value) => value.value).join(', ')}</p>)}<p className="muted">Options are shown read-only in this pass.</p></div> : null}
      <h3>{result.product.offers.length} merchant {result.product.offers.length === 1 ? 'offer' : 'offers'}</h3><p className="muted">Offers are shown in provider order and are not ranked. Currencies are not converted.</p>
      <div className="offers">{result.product.offers.map((offer) => <article className="offer" key={offer.identity.id}><h4>{offer.merchant?.name || offer.merchant?.domain || 'Merchant not named'}</h4><strong className="offer-price">{money(offer)}</strong><span>{availabilityText[offer.availability.state]}</span>{offer.selectedOptions.length > 0 && <p>{offer.selectedOptions.map((option) => `${option.name}: ${option.value}`).join(' · ')}</p>}<div className="offer-links">{safeExternal(offer.productUrl) && <a href={offer.productUrl} target="_blank" rel="noopener noreferrer">View on merchant site</a>}{safeExternal(offer.handoffUrl) && <a href={offer.handoffUrl} target="_blank" rel="noopener noreferrer">Continue with merchant</a>}</div></article>)}</div>
    </>}</aside>
}

function friendlyError(error: unknown) {
  if (!(error instanceof CatalogClientError)) return 'Something went wrong. Please try again.'
  if (error.code === 'provider_throttled') return `The live catalog is temporarily busy.${error.retryAfterSeconds ? ` Try again in about ${error.retryAfterSeconds} seconds.` : ' Please try again shortly.'}`
  if (error.code === 'provider_unavailable' || error.code === 'network_error') return 'Live catalog search is temporarily unavailable. Please try again.'
  if (error.code === 'malformed_response' || error.code === 'invalid_provider_response') return 'The catalog returned an unexpected result. Please try again.'
  return 'The catalog could not complete that request. Please check your search and try again.'
}

function App() {
  const purchaseGoal = usePurchaseGoal()
  const [query, setQuery] = useState(''); const [submitted, setSubmitted] = useState(''); const [products, setProducts] = useState<ProductCluster[]>([])
  const [cursor, setCursor] = useState<string>(); const [hasMore, setHasMore] = useState(false); const [status, setStatus] = useState<'idle'|'loading'|'loadingMore'|'success'|'empty'|'error'>('idle')
  const [error, setError] = useState(''); const [validation, setValidation] = useState(''); const [detail, setDetail] = useState<CatalogProductResult>(); const [detailState, setDetailState] = useState<'closed'|'loading'|'success'|'error'>('closed'); const [detailError, setDetailError] = useState('')

  async function search(nextQuery: string, nextCursor?: string) {
    const append = Boolean(nextCursor); setStatus(append ? 'loadingMore' : 'loading'); setError('')
    if (!append) { setProducts([]); setCursor(undefined); setHasMore(false); setDetail(undefined); setDetailState('closed') }
    try { const result = await catalogClient.search({ query: nextQuery, country: 'GB', currency: 'GBP', limit: 6, cursor: nextCursor }); setProducts((current) => append ? [...current, ...result.products] : result.products); setCursor(result.pagination.cursor); setHasMore(result.pagination.hasMore); setStatus(!append && result.products.length === 0 ? 'empty' : 'success') }
    catch (cause) { setError(friendlyError(cause)); setStatus('error') }
  }
  function submit(event: React.FormEvent) { event.preventDefault(); const trimmed = query.trim(); if (!trimmed) { setValidation('Enter a product to search for.'); return } setValidation(''); setSubmitted(trimmed); void search(trimmed) }
  async function openProduct(product: ProductCluster) { setDetail(undefined); setDetailError(''); setDetailState('loading'); try { setDetail(await catalogClient.product(product.identity.id)); setDetailState('success') } catch (cause) { setDetailError(friendlyError(cause)); setDetailState('error') } }

  return <div className="app-shell"><header className="site-header"><div><a className="brand" href="/">CoSource</a><span>Agent-native commerce intelligence</span></div><p>Human-authored intent · Live discovery</p></header><main>
    <PurchaseGoalPanel {...purchaseGoal} useSummary={() => setQuery(purchaseGoal.goal.summary.trim())}/>
    <section className="hero" aria-labelledby="page-title"><p className="eyebrow">2 · Search real products</p><h1 id="page-title">Search real products across merchants.</h1><p>Explore product clusters and inspect offers returned by participating Shopify merchants—without rankings, recommendations, or claims that they satisfy your goal.</p>
      <form className="search-form" onSubmit={submit}><label htmlFor="product-search">What are you looking for?</label><div className="search-row"><input id="product-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try notebook, backpack, or desk lamp" maxLength={500} aria-describedby={validation ? 'search-validation' : 'search-context'} /><button disabled={status === 'loading'}>{status === 'loading' ? 'Searching…' : 'Search products'}</button></div><p id="search-context">Searching with GB / GBP context. Every price keeps its returned currency.</p>{validation && <p id="search-validation" className="validation" role="alert">{validation}</p>}</form>
    </section><section className="discovery" aria-labelledby="results-title"><div className="results-head"><div><p className="eyebrow">Discovery results</p><h2 id="results-title">{submitted ? `Results for “${submitted}”` : 'Ready when you are'}</h2></div>{products.length > 0 && <span>{products.length} product {products.length === 1 ? 'cluster' : 'clusters'} shown</span>}</div>
      <div aria-live="polite">{status === 'idle' && <div className="empty-state"><h3>Start with an ordinary product search</h3><p>Results come live from the Shopify Global Catalog through CoSource’s secure gateway.</p></div>}{status === 'loading' && <div className="loading-grid" role="status"><span>Searching the live catalog…</span><i/><i/><i/></div>}{status === 'empty' && <div className="empty-state"><h3>No matching products returned</h3><p>Try a broader product name or check the spelling.</p></div>}{status === 'error' && <div className="notice error" role="alert"><p>{error}</p><button className="secondary" onClick={() => void search(submitted)}>Try again</button></div>}</div>
      {products.length > 0 && <div className="workspace"><div className="results-list">{products.map((product) => <ResultCard key={product.identity.id} product={product} onOpen={() => void openProduct(product)} />)}{hasMore && <button className="load-more" disabled={status === 'loadingMore'} onClick={() => void search(submitted, cursor)}>{status === 'loadingMore' ? 'Loading more…' : 'Load more products'}</button>}</div>{detailState !== 'closed' && <Detail result={detail} loading={detailState === 'loading'} error={detailError} onClose={() => setDetailState('closed')} />}</div>}
    </section></main><footer><p>Catalog facts may be incomplete or provider-inferred. Verify details with the merchant before purchase.</p></footer></div>
}
export default App
