import type { CoSourceSessionState } from '../application/cosource-application'

export type JourneyState = 'current' | 'ready' | 'waiting'
export type JourneyStepId = 'define' | 'discover' | 'compare' | 'plan' | 'review'
export interface JourneyStep { id: JourneyStepId; label: string; state: JourneyState; hint: string }

const usable = (status: CoSourceSessionState['humanDiscovery']['status']) => status === 'ready' || status === 'pagination_loading'

export function deriveJourneySteps(state: CoSourceSessionState): JourneyStep[] {
  const discovered = usable(state.humanDiscovery.status) && state.humanDiscovery.candidates.length > 0 || usable(state.agentDiscovery.status) && state.agentDiscovery.candidates.length > 0
  const compared = state.comparisonIds.length === 2
  const planned = state.plan.lines.length > 0
  const pendingReview = state.proposals.some((proposal) => proposal.status === 'pending')
  const current: JourneyStepId = !state.activeGoal ? 'define' : planned ? 'review' : !discovered ? 'discover' : !compared ? 'compare' : 'plan'
  const values = [['define', 'Define', Boolean(state.activeGoal), 'Commit a clear buying goal'], ['discover', 'Discover', discovered, 'Source live commerce results'], ['compare', 'Compare', compared, 'Select two candidates'], ['plan', 'Plan', planned, 'Add your chosen product'], ['review', 'Review', pendingReview, pendingReview ? 'Pending proposal needs review' : 'Approve or reject proposals']] as const
  return values.map(([id, label, complete, hint]) => ({ id, label, hint, state: id === current ? 'current' : complete ? 'ready' : 'waiting' }))
}

export function journeyAction(state: CoSourceSessionState) {
  const current = deriveJourneySteps(state).find((step) => step.state === 'current')?.id ?? 'define'
  return ({
    define: { label: 'Define your goal', href: '#stage-define' },
    discover: { label: 'Discover products', href: '#stage-discover' },
    compare: { label: 'Complete comparison', href: '#stage-compare' },
    plan: { label: 'Build purchase plan', href: '#stage-plan' },
    review: { label: 'Review agent activity and proposals', href: '#stage-review' },
  } as const)[current]
}
