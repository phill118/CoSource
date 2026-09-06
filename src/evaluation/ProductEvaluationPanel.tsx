import type { ProvenanceKind } from '../commerce/domain/commerce'
import type { ConditionEvaluation, EvaluationStatus, ProductEvaluation } from './domain/product-evaluation'
import './ProductEvaluationPanel.css'

const evidenceLabels: Record<ProvenanceKind,string> = { provider_explicit:'Provided', provider_inferred:'Inferred', cosource_derived:'Derived', unknown:'Unknown' }
const statusLabels: Record<EvaluationStatus,string> = { satisfied:'Satisfied', failed:'Failed', unknown:'Unknown' }
const statusMarks: Record<EvaluationStatus,string> = { satisfied:'✓', failed:'✕', unknown:'?' }
const eligibilityLabels = { eligible:'Eligible', eligible_with_unknowns:'Eligible — some mandatory conditions unverified', ineligible:'Not eligible' }

function EvaluationRows({ title, rows, empty }: { title:string; rows:ConditionEvaluation[]; empty:string }) {
  return <section className="evaluation-group"><h4>{title}</h4>{rows.length ? <ul>{rows.map((row) => <li key={row.conditionId} className={`evaluation-row ${row.status}`}><span className="evaluation-mark" aria-hidden="true">{statusMarks[row.status]}</span><div><strong>{statusLabels[row.status]}</strong><p>{row.reason}</p><span className="evidence-label">{evidenceLabels[row.evidence.kind]}{row.evidence.value ? ` · ${row.evidence.value}` : ''}</span></div></li>)}</ul> : <p className="muted">{empty}</p>}</section>
}

export function ProductEvaluationPanel({ evaluation }: { evaluation:ProductEvaluation }) {
  return <section className="evaluation-panel" aria-labelledby="evaluation-title"><p className="eyebrow">Evidence-aware evaluation</p><h3 id="evaluation-title">{eligibilityLabels[evaluation.eligibility]}</h3><p className="trust-note">Against goal revision {evaluation.goalRevision}. Unknown does not mean satisfied. Products and offers remain in provider order.</p>
    {evaluation.evidence&&<p><strong>Evidence:</strong> {evaluation.evidence.freshness.replaceAll('_',' ')}{evaluation.evidence.observedAt?` · Last observed ${new Date(evaluation.evidence.observedAt).toLocaleString()}`:''}</p>}
    {evaluation.readiness&&<div className={`notice ${evaluation.readiness==='ready_on_current_evidence'?'':'error'}`}><strong>Decision readiness: {evaluation.readiness.replaceAll('_',' ')}</strong>{evaluation.readinessReasons?.map(reason=><p key={reason}>{reason}</p>)}</div>}
    <div className="evaluation-counts"><span>{evaluation.counts.satisfied} satisfied</span><span>{evaluation.counts.failed} failed</span><span>{evaluation.counts.unknown} unknown</span></div>
    {evaluation.budget && <section className="evaluation-group"><h4>Budget evidence</h4><div className={`budget-evaluation ${evaluation.budget.status}`}><strong>{statusLabels[evaluation.budget.status]}</strong><p>{evaluation.budget.reason}</p><span className="evidence-label">{evidenceLabels[evaluation.budget.evidence.kind]}</span></div></section>}
    <EvaluationRows title="Hard requirements" rows={evaluation.requirements} empty="No hard requirements entered."/><EvaluationRows title="Preferences" rows={evaluation.preferences} empty="No preferences entered."/><EvaluationRows title="Exclusions" rows={evaluation.exclusions} empty="No exclusions entered."/>
  </section>
}
