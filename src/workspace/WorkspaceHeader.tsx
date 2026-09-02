import type { CoSourceSessionState, GoalCommitmentStatus } from '../application/cosource-application'
import type { WebMCPStatus } from '../webmcp/use-webmcp'
import { deriveJourneySteps, journeyAction } from './journey'
import './WorkspaceHeader.css'

const webmcpLabels: Record<WebMCPStatus, string> = { unavailable: 'Agent tools unavailable', registering: 'Agent tools connecting', ready: 'Agent tools ready', error: 'Agent tools unavailable' }

export function WorkspaceHeader({ state, commitment, webmcp, toolCount }: { state: CoSourceSessionState; commitment: GoalCommitmentStatus; webmcp: WebMCPStatus; toolCount: number }) {
  const steps = deriveJourneySteps(state)
  const action = journeyAction(state)
  return <><header className="product-header"><div className="product-brand"><a href="/" aria-label="CoSource home">CoSource</a><span>Purchasing intelligence workspace</span></div><div className="header-context"><span>{state.market.country} · {state.market.currency}</span><span className={`readiness readiness-${webmcp}`}>{webmcpLabels[webmcp]}{webmcp === 'ready' ? ` · ${toolCount}` : ''}</span></div></header><section className="welcome" aria-labelledby="welcome-title"><div><p className="eyebrow">Human-controlled commerce research</p><h1 id="welcome-title">Turn a buying need into an evidence-backed, multi-merchant purchase plan.</h1><p>AI can research and propose. You approve every goal and plan change, and you choose when to continue with a merchant.</p></div><aside><strong>{commitment === 'committed' ? 'Active goal committed' : commitment === 'uncommitted_changes' ? 'Draft changes need commitment' : 'Start with a buying need'}</strong><p>{commitment === 'uncommitted_changes' ? 'The active goal still controls sourcing until you commit this draft.' : 'Real catalog data stays separate from agent proposals and human decisions.'}</p><a className="button-link" href={action.href}>{action.label}</a></aside></section><nav className="journey-nav" aria-label="Purchase journey"><ol>{steps.map((step, index) => <li key={step.id} data-state={step.state}><a href={`#stage-${step.id}`} aria-current={step.state === 'current' ? 'step' : undefined}><span>{index + 1}</span><strong>{step.label}</strong><small>{step.hint}</small></a></li>)}</ol></nav></>
}
