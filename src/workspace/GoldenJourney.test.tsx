// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import App from '../App'

const provenance = { kind: 'provider_explicit', provider: 'shopify_global_catalog' }
const product = (id: string, title: string) => ({ identity: { provider: 'shopify_global_catalog', id }, title: { value: title, provenance }, media: [], featuredOfferId: `${id}-offer`, offerCompleteness: 'featured_only', provenance, offers: [{ identity: { provider: 'shopify_global_catalog', id: `${id}-offer` }, title: { value: title, provenance }, price: { minorAmount: 2499, currency: 'GBP' }, availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance }] })
const ok = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
const navigate=(name:string)=>userEvent.click(screen.getByRole('link',{name}))
const openExploratory=async()=>{const summary=screen.getByText('Exploratory catalog search');await userEvent.click(summary)}

afterEach(() => { cleanup(); history.replaceState(null,'','/'); vi.unstubAllGlobals() })

// Full-App interaction needs a bounded integration budget under aggregate worker contention.
describe('competition golden journey', { timeout: 10_000 }, () => {
  it('loads the example into the editable draft only', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Use example buying need' }))
    expect(screen.getByLabelText('What are you trying to buy or achieve?')).toHaveValue('Equip a 12-person mobile design team with reliable business laptops')
    expect(screen.getByLabelText('Product being sourced')).toHaveValue('business laptop')
    expect(screen.getByLabelText('Quantity optional')).toHaveValue(12)
    expect(screen.getByLabelText('Maximum item price amount')).toHaveValue('1500.00')
    expect(screen.getByLabelText('Budget amount')).toHaveValue('18000.00')
    expect(screen.getByLabelText('Must have 1 value')).toHaveValue('32 GB RAM')
    expect(screen.getByLabelText('Must have 2 value')).toHaveValue('1 TB SSD')
    expect(screen.getByLabelText('Must have 3 value')).toHaveValue('Three-year warranty')
    expect(screen.getByLabelText('Prefer 1 value')).toHaveValue('Repairable design')
    expect(screen.getByLabelText('Prefer 2 value')).toHaveValue('Replaceable storage')
    expect(screen.getByLabelText('Exclude 1 value')).toHaveValue('Refurbished devices')
    expect(screen.getByText('No active goal. Commit a valid draft explicitly.')).toBeInTheDocument()
    expect(screen.getByText('No human or agent activity yet.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps commitment explicit and exploratory discovery distinct', async () => {
    render(<App />)
    expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Commit draft as active goal' })).not.toBeInTheDocument()
    await navigate('Discover');await openExploratory()
    expect(screen.getByLabelText('What are you looking for?')).toBeInTheDocument()
    expect(screen.getAllByText('Exploratory search').length).toBeGreaterThan(0)
    expect(document.getElementById('stage-compare')).not.toBeInTheDocument()
  })

  it('changes only the presentation view while preserving the editable draft', async () => {
    render(<App />)
    const main=screen.getByRole('main')
    expect(main).toHaveAttribute('data-active-view','define')
    await userEvent.type(screen.getByLabelText('What are you trying to buy or achieve?'),'A retained human draft')
    await userEvent.click(screen.getByRole('link',{name:'Discover'}))
    expect(main).toHaveAttribute('data-active-view','discover')
    await userEvent.click(screen.getByRole('link',{name:'Define'}))
    expect(screen.getByLabelText('What are you trying to buy or achieve?')).toHaveValue('A retained human draft')
    expect(document.getElementById('decision-intelligence')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link',{name:'Decision intelligence'}))
    expect(main).toHaveAttribute('data-active-view','intelligence')
    expect(document.getElementById('decision-intelligence')).toBeVisible()
  })

  it('presents unavailable agent tools honestly without hiding core controls', () => {
    render(<App />)
    expect(screen.getByText('WebMCP unavailable in this browser')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use example buying need' })).toBeInTheDocument()
  })

  it('gives every journey link a real locked and unlocked destination', async () => {
    render(<App />)
    const assertTargets = async () => { for(const link of screen.getByRole('navigation', { name: 'Workspace navigation' }).querySelectorAll('a')){await userEvent.click(link);expect(document.querySelector(link.getAttribute('href')!)).toBeVisible()} }
    await assertTargets()
    await navigate('Define')
    await userEvent.click(screen.getByRole('button', { name: 'Use example buying need' }))
    await userEvent.click(screen.getByRole('button', { name: 'Commit draft as active goal' }))
    await assertTargets()
  })

  it('keeps direct hashes and history navigation coherent without changing the draft', async () => {
    window.history.replaceState(null,'','/#stage-define')
    render(<App />)
    const main=screen.getByRole('main'),draft=screen.getByLabelText('What are you trying to buy or achieve?')
    expect(main).toHaveAttribute('data-active-view','define')
    fireEvent.change(draft,{target:{value:'Human-owned draft remains intact'}})
    window.history.pushState(null,'','/#stage-plan');fireEvent(window,new HashChangeEvent('hashchange'))
    expect(main).toHaveAttribute('data-active-view','plan')
    window.history.pushState(null,'','/#stage-discover');fireEvent(window,new HashChangeEvent('hashchange'))
    expect(main).toHaveAttribute('data-active-view','discover')
    window.history.back()
    await waitFor(()=>expect(window.location.hash).toBe('#stage-plan'))
    await waitFor(()=>expect(main).toHaveAttribute('data-active-view','plan'))
    window.history.forward()
    await waitFor(()=>expect(window.location.hash).toBe('#stage-discover'))
    await waitFor(()=>expect(main).toHaveAttribute('data-active-view','discover'))
    await navigate('Define');expect(screen.getByLabelText('What are you trying to buy or achieve?')).toHaveValue('Human-owned draft remains intact')
  })

  it('projects canonical activity read-only in the context rail', async()=>{
    render(<App />)
    await userEvent.click(screen.getByRole('button',{name:'Use example buying need'}))
    await userEvent.click(screen.getByRole('button',{name:'Commit draft as active goal'}))
    const activity=screen.getByRole('heading',{name:'Human and agent trail'}).closest('section')!
    expect(activity).toHaveTextContent('Human')
    expect(activity).toHaveTextContent(/committed/i)
    expect(activity.querySelector('button')).toBeNull()
    expect(activity.querySelector('input')).toBeNull()
  })

  it('shows compact honest empty interpretation and plan-proposal guidance', () => {
    render(<App />)
    expect(screen.getByText('Agent goal interpretations are optional.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Goal interpretation proposals' })).not.toBeInTheDocument()
  })

  it('guides zero, one, and two human comparison selections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(await ok({ products: [product('a', 'Alpha Pack'), product('b', 'Beta Pack')], messages: [], pagination: { hasMore: false } })))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Use example buying need' }))
    await userEvent.click(screen.getByRole('button', { name: 'Commit draft as active goal' }))
    await navigate('Discover');await openExploratory()
    const input = screen.getByLabelText('What are you looking for?')
    await userEvent.type(input, 'backpack')
    await userEvent.click(screen.getByRole('button', { name: 'Search products' }))
    await screen.findByText('Alpha Pack')
    const selects = screen.getAllByRole('button', { name: 'Select for comparison' })
    await userEvent.click(selects[0]!)
    await navigate('Compare')
    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument()
    expect(screen.getByText(/Alpha Pack is selected. Select one more/i)).toBeInTheDocument()
    await navigate('Discover')
    await userEvent.click(screen.getAllByRole('button', { name: 'Select for comparison' })[0]!)
    await navigate('Compare')
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Product comparison' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add to purchase plan' })).toHaveLength(2)
  })
})
