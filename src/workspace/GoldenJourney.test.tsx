// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import App from '../App'

const provenance = { kind: 'provider_explicit', provider: 'shopify_global_catalog' }
const product = (id: string, title: string) => ({ identity: { provider: 'shopify_global_catalog', id }, title: { value: title, provenance }, media: [], featuredOfferId: `${id}-offer`, offerCompleteness: 'featured_only', provenance, offers: [{ identity: { provider: 'shopify_global_catalog', id: `${id}-offer` }, title: { value: title, provenance }, price: { minorAmount: 2499, currency: 'GBP' }, availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance }] })
const ok = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// Full-App interaction needs a bounded integration budget under aggregate worker contention.
describe('competition golden journey', { timeout: 10_000 }, () => {
  it('loads the example into the editable draft only', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Use example buying need' }))
    expect(screen.getByLabelText('What are you trying to buy or achieve?')).toHaveValue('Equip 30 pupils with waterproof backpacks for a school trip')
    expect(screen.getByLabelText('Product being sourced')).toHaveValue('waterproof school backpack')
    expect(screen.getByLabelText('Quantity optional')).toHaveValue(30)
    expect(screen.getByLabelText('Maximum item price amount')).toHaveValue('35.00')
    expect(screen.getByLabelText('Budget amount')).toHaveValue('1050.00')
    expect(screen.getByLabelText('Must have 1 value')).toHaveValue('Waterproof')
    expect(screen.getByLabelText('Prefer 1 value')).toHaveValue('Reflective details')
    expect(screen.getByLabelText('Exclude 1 value')).toHaveValue('Leather')
    expect(screen.getByText('No active goal. Commit a valid draft explicitly.')).toBeInTheDocument()
    expect(screen.getByText('No tool or proposal activity this session.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps commitment explicit and exploratory discovery distinct', async () => {
    render(<App />)
    expect(screen.getByRole('navigation', { name: 'Purchase journey' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Commit draft as active goal' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('What are you looking for?')).toBeInTheDocument()
    expect(screen.getAllByText('Exploratory search').length).toBeGreaterThan(0)
    expect(screen.getByText(/commit a goal before comparing candidates/i)).toBeInTheDocument()
  })

  it('presents unavailable agent tools honestly without hiding core controls', () => {
    render(<App />)
    expect(screen.getAllByText('Agent tools unavailable').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Use example buying need' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search products' })).toBeInTheDocument()
  })

  it('gives every journey link a real locked and unlocked destination', async () => {
    render(<App />)
    const assertTargets = () => screen.getByRole('navigation', { name: 'Purchase journey' }).querySelectorAll('a').forEach((link) => expect(document.querySelector(link.getAttribute('href')!)).toBeVisible())
    assertTargets()
    await userEvent.click(screen.getByRole('button', { name: 'Use example buying need' }))
    await userEvent.click(screen.getByRole('button', { name: 'Commit draft as active goal' }))
    assertTargets()
    expect(document.querySelector('#stage-compare')).toHaveClass('decision-workspace')
    expect(document.querySelector('#stage-plan')).toHaveClass('plan-panel')
  })

  it('shows compact honest empty interpretation and plan-proposal guidance', () => {
    render(<App />)
    expect(screen.getByText('Agent goal interpretations are optional.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Goal interpretation proposals' })).not.toBeInTheDocument()
    expect(screen.getByText('No agent plan proposals this session.')).toBeInTheDocument()
    expect(screen.getByText(/only you can approve and apply them/i)).toBeInTheDocument()
  })

  it('guides zero, one, and two human comparison selections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(await ok({ products: [product('a', 'Alpha Pack'), product('b', 'Beta Pack')], messages: [], pagination: { hasMore: false } })))
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Use example buying need' }))
    await userEvent.click(screen.getByRole('button', { name: 'Commit draft as active goal' }))
    expect(screen.getByText('0 of 2 selected')).toBeInTheDocument()
    expect(screen.getByText(/select two result candidates/i)).toBeInTheDocument()
    const input = screen.getByLabelText('What are you looking for?')
    await userEvent.type(input, 'backpack')
    await userEvent.click(screen.getByRole('button', { name: 'Search products' }))
    await screen.findByText('Alpha Pack')
    const selects = screen.getAllByRole('button', { name: 'Select for comparison' })
    await userEvent.click(selects[0]!)
    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument()
    expect(screen.getByText(/Alpha Pack is selected. Select one more/i)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Select for comparison' })[0]!)
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Product comparison' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add to purchase plan' })).toHaveLength(2)
  })
})
