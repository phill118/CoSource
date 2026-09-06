// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import '@testing-library/jest-dom/vitest'
import { createCoSourceApplication, type CoSourceSessionState } from '../application/cosource-application'
import type { ProductCluster } from '../commerce/domain/commerce'
import { WorkspaceHeader } from './WorkspaceHeader'
import { deriveJourneySteps, journeyAction } from './journey'

const catalog = { search: async () => ({ products: [], messages: [], pagination: { hasMore: false } }), product: async () => { throw new Error('unused') } }
const app = createCoSourceApplication({ catalog, market: { country: 'GB', currency: 'GBP' }, makeId: () => 'id' })
const base = app.getSnapshot()
const identity = (id: string) => ({ provider: 'shopify_global_catalog' as const, id })
const candidate = (id: string, title = id) => ({ identity: identity(id), title: { value: title, provenance: { kind: 'provider_explicit' as const } } } as ProductCluster)
const activeGoal = { ...base.goalDraft, state: 'validated' as const }
const state = (changes: Partial<CoSourceSessionState> = {}): CoSourceSessionState => ({ ...base, activeGoal, ...changes })
const current = (value: CoSourceSessionState) => deriveJourneySteps(value).find((step) => step.state === 'current')?.id

afterEach(cleanup)

describe('workspace journey presentation', () => {
  it('derives all five stages from canonical application state', () => {
    const discovered = state({ humanDiscovery: { ...base.humanDiscovery, status: 'ready', candidates: [candidate('a'), candidate('b')] } })
    const compared = { ...discovered, comparisonIds: [identity('a'), identity('b')] }
    const planned = { ...compared, plan: { ...base.plan, lines: [{}] } } as CoSourceSessionState
    expect([current(base), current(state()), current(discovered), current(compared), current(planned)]).toEqual(['define', 'discover', 'compare', 'plan', 'review'])
    expect(current(state({ plan: { ...base.plan, lines: [{}] } as CoSourceSessionState['plan'] }))).toBe('review')
  })

  it('does not treat stale candidates as current discovery and accepts applicable agent candidates', () => {
    const stale = state({ humanDiscovery: { ...base.humanDiscovery, status: 'stale', candidates: [candidate('old')] } })
    expect(current(stale)).toBe('discover')
    const agent = state({ agentDiscovery: { ...base.agentDiscovery, status: 'ready', candidates: [candidate('agent')] } })
    expect(current(agent)).toBe('compare')
  })

  it('keeps exactly one current step and makes pending Review actionable', () => {
    const pending = state({ humanDiscovery: { ...base.humanDiscovery, status: 'ready', candidates: [candidate('a'), candidate('b')] }, comparisonIds: [identity('a'), identity('b')], plan: { ...base.plan, lines: [{}] } as CoSourceSessionState['plan'], proposals: [{ status: 'pending' }] as CoSourceSessionState['proposals'] })
    const steps = deriveJourneySteps(pending)
    expect(steps.filter((step) => step.state === 'current')).toHaveLength(1)
    expect(steps.find((step) => step.id === 'review')).toMatchObject({ state: 'current' })
    expect(journeyAction(pending)).toEqual({ label: 'Review agent activity and proposals', href: '#stage-review' })
  })

  it.each([
    ['Define your goal', base],
    ['Discover products', state()],
    ['Complete comparison', state({ humanDiscovery: { ...base.humanDiscovery, status: 'ready', candidates: [candidate('a')] } })],
    ['Build purchase plan', state({ humanDiscovery: { ...base.humanDiscovery, status: 'ready', candidates: [candidate('a'), candidate('b')] }, comparisonIds: [identity('a'), identity('b')] })],
    ['Review agent activity and proposals', state({ humanDiscovery: { ...base.humanDiscovery, status: 'ready', candidates: [candidate('a'), candidate('b')] }, comparisonIds: [identity('a'), identity('b')], plan: { ...base.plan, lines: [{}] } as CoSourceSessionState['plan'] })],
  ])('renders the dynamic next action %s', (label, session) => {
    render(createElement(WorkspaceHeader, { state: session as CoSourceSessionState, commitment: session === base ? 'no_active_goal' : 'committed', webmcp: 'unavailable', toolCount: 0 }))
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'step')).toHaveLength(1)
  })

  it('signals draft changes while preserving the active journey action', () => {
    render(createElement(WorkspaceHeader, { state: state(), commitment: 'uncommitted_changes', webmcp: 'ready', toolCount: 13 }))
    expect(screen.getByText('Draft changes need commitment')).toBeInTheDocument()
    expect(screen.getByText(/active goal still controls sourcing/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Discover products' })).toHaveAttribute('href', '#stage-discover')
  })

  it('positions the purchase surface over the shared engine without changing authority', () => {
    render(createElement(WorkspaceHeader, { state: base, commitment: 'no_active_goal', webmcp: 'unavailable', toolCount: 0 }))
    expect(screen.getByRole('link', { name: 'CoSource Purchasing home' })).toBeInTheDocument()
    expect(screen.getByText('Powered by the CoSource Resource Resolution Engine')).toBeInTheDocument()
    expect(screen.getByText(/You approve every goal and plan change/)).toBeInTheDocument()
  })
})
