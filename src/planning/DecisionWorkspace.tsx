import type { ProductCluster, ProviderIdentity } from '../commerce/domain/commerce'
import { providerIdentityKey, sameProviderIdentity } from '../commerce/domain/provider-identity'
import { formatMoney } from '../commerce/domain/money-display'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import type { ProductComparison } from '../comparison/domain/product-comparison'
import type { PlanEvaluation, PurchasePlan } from './domain/purchase-plan'
import './DecisionWorkspace.css'

const outcomeLabels = {
  candidate_a_stronger: 'First candidate is stronger on known evidence',
  candidate_b_stronger: 'Second candidate is stronger on known evidence',
  tradeoff: 'No clear winner — evidence trade-off',
  insufficient_evidence: 'No clear winner — insufficient evidence',
  equivalent_on_known_evidence: 'Equivalent on known evidence',
}

export function DecisionWorkspace({ evidenceProducts, plan, planEvaluation, comparison, onClearComparison, onAddProduct, onRemoveLine, onSetQuantity, onSelectOffer, onRebase }: {
  goal: PurchaseGoal; products: ProductCluster[]; evidenceProducts: ProductCluster[]; plan:PurchasePlan;planEvaluation:PlanEvaluation;comparison?:ProductComparison;comparisonIds: ProviderIdentity[]; onClearComparison: () => void
  onAddProduct:(identity:ProviderIdentity)=>void;onRemoveLine:(lineId:string)=>void;onSetQuantity:(lineId:string,quantity:number)=>void;onSelectOffer:(lineId:string,offer?:ProviderIdentity)=>void;onRebase:()=>void
}) {
  return <section className="decision-workspace" aria-labelledby="decision-title">
    <p className="eyebrow">3 · Compare and plan</p><h2 id="decision-title">Human decision workspace</h2>
    <p>Comparison uses known evaluation dimensions without a score. Adding a product remains your decision.</p>
    {comparison && <section className="comparison-panel">
      <div className="workspace-head"><h3>Product comparison</h3><button className="quiet" onClick={onClearComparison}>Clear comparison</button></div>
      <div className="comparison-grid">{[comparison.candidateA, comparison.candidateB].map((candidate) => <article key={providerIdentityKey(candidate.product)}>
        <h4>{candidate.title}</h4><p>{candidate.evaluation.eligibility.replaceAll('_', ' ')}</p><dl>
          <div><dt>Mandatory satisfied</dt><dd>{candidate.metrics.mandatorySatisfied}</dd></div>
          <div><dt>Mandatory failures</dt><dd>{candidate.metrics.mandatoryFailures}</dd></div>
          <div><dt>Mandatory unknowns</dt><dd>{candidate.metrics.mandatoryUnknowns}</dd></div>
          <div><dt>Exclusion violations</dt><dd>{candidate.metrics.exclusionViolations}</dd></div>
          <div><dt>Preferences satisfied / unknown</dt><dd>{candidate.metrics.preferencesSatisfied} / {candidate.metrics.preferencesUnknown}</dd></div>
          <div><dt>Evidence provided / inferred / derived / unknown</dt><dd>{candidate.evidence.provided} / {candidate.evidence.inferred} / {candidate.evidence.derived} / {candidate.evidence.unknown}</dd></div>
        </dl><button onClick={() => onAddProduct(candidate.product)}>Add to purchase plan</button>
      </article>)}</div>
      <h4>{outcomeLabels[comparison.outcome]}</h4>{comparison.reasons.map((reason) => <p key={reason}>{reason}</p>)}
      <p className="muted">{comparison.priceReason}</p>
    </section>}
    <section className="plan-panel">
      <div className="workspace-head"><div><h3>Purchase plan</h3><span>Plan revision {plan.revision} · Goal revision {plan.goalRevision}</span></div>{planEvaluation.stale && <button onClick={onRebase}>Re-evaluate with current goal</button>}</div>
      {planEvaluation.stale && <p className="stale-warning" role="alert">The goal changed after this plan was assembled. Existing evaluation is stale.</p>}
      <p>Status: <strong>{planEvaluation.status.replaceAll('_', ' ')}</strong></p>
      {planEvaluation.budget && <div className={`plan-budget budget-${planEvaluation.budget.status}`}>
        <h4>Plan budget: {planEvaluation.budget.status}</h4><p>{planEvaluation.budget.reason}</p>
        <p>Goal budget: {formatMoney(planEvaluation.budget.goalBudget)}{planEvaluation.budget.comparableSubtotal && <> · Safely known comparable subtotal: {formatMoney(planEvaluation.budget.comparableSubtotal)}</>}</p>
      </div>}
      <p>Known conflicts: {planEvaluation.mandatoryFailures + planEvaluation.exclusionViolations} · Unverified requirements: {planEvaluation.mandatoryUnknowns} · Preferences satisfied / unknown: {planEvaluation.preferencesSatisfied} / {planEvaluation.preferencesUnknown}</p>
      {plan.lines.length === 0 ? <p className="muted">No products added. Compare candidates or add one from search.</p> : <div className="plan-lines">{plan.lines.map((line) => {
        const product = evidenceProducts.find((item) => sameProviderIdentity(item.identity, line.product))
        return <article key={line.id}><div><h4>{line.productTitle}</h4>
          <label>Quantity <input type="number" min="1" max="100000" value={line.quantity ?? 1} onChange={(event) => { const quantity=Number(event.target.value); if(Number.isInteger(quantity)&&quantity>=1&&quantity<=100_000)onSetQuantity(line.id,quantity) }}/></label>
          {product && product.offers.length > 1 && <label>Merchant offer <select value={line.selectedOffer ? providerIdentityKey(line.selectedOffer) : ''} onChange={(event) => { const offer = product.offers.find((item) => providerIdentityKey(item.identity) === event.target.value); onSelectOffer(line.id, offer?.identity) }}>
            <option value="">Not selected</option>{product.offers.map((offer) => <option key={providerIdentityKey(offer.identity)} value={providerIdentityKey(offer.identity)}>{offer.merchant?.name || offer.merchant?.domain || offer.identity.id} — {formatMoney(offer.price)}</option>)}
          </select></label>}
          {product && product.offers.length === 1 && <p className="muted">Sole returned offer available for evidence.</p>}
        </div><button className="remove" onClick={() => onRemoveLine(line.id)}>Remove</button></article>
      })}</div>}
      <div className="plan-summary"><p>Selected merchants: {planEvaluation.merchantCount}</p><p>Currencies: {planEvaluation.currencies.join(', ') || 'None selected'}</p>
        <h4>Known item-price subtotals</h4>{planEvaluation.knownSubtotals.length ? planEvaluation.knownSubtotals.map((total) => <strong key={total.currency}>{formatMoney(total)}</strong>) : <p className="muted">No safely calculable subtotal.</p>}
        {planEvaluation.unresolvedCosts.map((note) => <p className="unresolved" key={note}>{note}</p>)}
        <p className="muted">Known subtotals exclude shipping and tax and are not final payable totals.</p>
      </div>
    </section>
  </section>
}
