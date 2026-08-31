import type { MerchantOffer, ProductCluster, ProvenanceKind } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import { evaluateProductAgainstGoal } from './evaluate-product'
import type { ConditionEvaluation, EvaluationStatus } from './domain/product-evaluation'
import './ProductEvaluationPanel.css'

const evidenceLabels: Record<ProvenanceKind,string> = { provider_explicit:'Provided', provider_inferred:'Inferred', cosource_derived:'Derived', unknown:'Unknown' }
const statusLabels: Record<EvaluationStatus,string> = { satisfied:'Satisfied', failed:'Failed', unknown:'Unknown' }
const statusMarks: Record<EvaluationStatus,string> = { satisfied:'✓', failed:'✕', unknown:'?' }
const eligibilityLabels = { eligible:'Eligible', eligible_with_unknowns:'Eligible — some mandatory conditions unverified', ineligible:'Not eligible' }

function EvaluationRows({ title, rows, empty }: { title:string; rows:ConditionEvaluation[]; empty:string }) {
  return <section className="evaluation-group"><h4>{title}</h4>{rows.length ? <ul>{rows.map((row) => <li key={row.conditionId} className={`evaluation-row ${row.status}`}><span className="evaluation-mark" aria-hidden="true">{statusMarks[row.status]}</span><div><strong>{statusLabels[row.status]}</strong><p>{row.reason}</p><span className="evidence-label">{evidenceLabels[row.evidence.kind]}{row.evidence.value ? ` · ${row.evidence.value}` : ''}</span></div></li>)}</ul> : <p className="muted">{empty}</p>}</section>
}

function selectedOffer(product: ProductCluster): MerchantOffer | undefined {
  if (product.featuredOfferId) {
    const featured = product.offers.find((offer) => offer.identity.id === product.featuredOfferId)
    if (featured) return featured
  }
  return product.offers.length === 1 ? product.offers[0] : undefined
}

export function ProductEvaluationPanel({ goal, product }: { goal:PurchaseGoal; product:ProductCluster }) {
  const evaluation = evaluateProductAgainstGoal(goal, product, selectedOffer(product))
  return <section className="evaluation-panel" aria-labelledby="evaluation-title"><p className="eyebrow">Evidence-aware evaluation</p><h3 id="evaluation-title">{eligibilityLabels[evaluation.eligibility]}</h3><p className="trust-note">Against goal revision {evaluation.goalRevision}. Unknown does not mean satisfied. Products and offers remain in provider order.</p>
    <div className="evaluation-counts"><span>{evaluation.counts.satisfied} satisfied</span><span>{evaluation.counts.failed} failed</span><span>{evaluation.counts.unknown} unknown</span></div>
    {evaluation.budget && <section className="evaluation-group"><h4>Budget evidence</h4><div className={`budget-evaluation ${evaluation.budget.status}`}><strong>{statusLabels[evaluation.budget.status]}</strong><p>{evaluation.budget.reason}</p><span className="evidence-label">{evidenceLabels[evaluation.budget.evidence.kind]}</span></div></section>}
    <EvaluationRows title="Hard requirements" rows={evaluation.requirements} empty="No hard requirements entered."/><EvaluationRows title="Preferences" rows={evaluation.preferences} empty="No preferences entered."/><EvaluationRows title="Exclusions" rows={evaluation.exclusions} empty="No exclusions entered."/>
  </section>
}
