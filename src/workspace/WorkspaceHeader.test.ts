// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import '@testing-library/jest-dom/vitest'
import { createCoSourceApplication, type CoSourceSessionState } from '../application/cosource-application'
import type { ProductCluster } from '../commerce/domain/commerce'
import { WorkspaceHeader, WorkspaceNavigation } from './WorkspaceHeader'
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

  it('keeps the global header limited to project-wide state', () => {
    render(createElement(WorkspaceHeader, { state: base, commitment: 'no_active_goal', webmcp: 'unavailable', toolCount: 0 }))
    expect(screen.getByRole('link', { name: 'CoSource Purchasing home' })).toBeInTheDocument()
    expect(screen.getByText('Procurement intelligence')).toBeInTheDocument()
    expect(screen.getByText('GB / GBP')).toBeInTheDocument()
    expect(screen.getByText('WebMCP unavailable in this browser')).toBeInTheDocument()
    expect(screen.queryByText(/tools available/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/registered WebMCP tools/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows the exact registered tool count only when WebMCP is ready', () => {
    render(createElement(WorkspaceHeader, { state: base, commitment: 'no_active_goal', webmcp: 'ready', toolCount: 13 }))
    expect(screen.getByText('13 registered WebMCP tools')).toBeInTheDocument()
    expect(screen.queryByText(/real-market search/i)).not.toBeInTheDocument()
  })

  it('presents registration as connecting without claiming availability', () => {
    render(createElement(WorkspaceHeader, { state: base, commitment: 'no_active_goal', webmcp: 'registering', toolCount: 0 }))
    expect(screen.getByText('Agent tools connecting')).toBeInTheDocument()
    expect(screen.queryByText(/tools available|registered WebMCP tools/i)).not.toBeInTheDocument()
  })

  it('renders one restrained workflow rail from canonical journey state', () => {
    render(createElement(WorkspaceNavigation,{state:state(),activeView:'discover',onNavigate:()=>undefined}))
    expect(screen.getAllByRole('link')).toHaveLength(7)
    expect(screen.getByRole('link',{name:/Discover/})).toHaveAttribute('aria-current','page')
    expect(screen.getByRole('link',{name:/Define/}).closest('li')).toHaveAttribute('data-state','ready')
  })
})
