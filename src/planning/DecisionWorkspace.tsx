import {useState} from 'react'
import type { ProductCluster, ProviderIdentity } from '../commerce/domain/commerce'
import { providerIdentityKey, sameProviderIdentity } from '../commerce/domain/provider-identity'
import { formatMoney } from '../commerce/domain/money-display'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import type { ProductComparison } from '../comparison/domain/product-comparison'
import type { PlanEvaluation, PurchasePlan } from './domain/purchase-plan'
import type { ProductEvidenceEntry } from '../evidence/product-evidence-ledger'
import type { ApplicationResult, EvidenceRefreshState } from '../application/cosource-application'
import type {ScenarioSet} from '../scenarios/domain/scenario'
import './DecisionWorkspace.css'

const outcomeLabels = {
  candidate_a_stronger: 'First candidate is stronger on known evidence',
  candidate_b_stronger: 'Second candidate is stronger on known evidence',
  tradeoff: 'No clear winner — evidence trade-off',
  insufficient_evidence: 'No clear winner — insufficient evidence',
  equivalent_on_known_evidence: 'Equivalent on known evidence',
}

export function ScenarioPlanningPanel({scenarios,onApplyScenario}:{scenarios?:ScenarioSet;onApplyScenario:(input:unknown)=>ApplicationResult<PurchasePlan>}){
 const[scenarioFeedback,setScenarioFeedback]=useState<{kind:'status'|'alert';message:string}>()
 return <section className="scenario-panel" id="scenario-planning" aria-labelledby="scenario-title"><div className="workspace-head"><div><h3 id="scenario-title">Scenario planning</h3><span>Derived from current canonical evidence; alternatives are not stored as plan truth.</span></div></div>
  {!scenarios||scenarios.scenarios.length===0?<p>Commit a buying goal and retain suitable candidate evidence to generate bounded scenarios.</p>:<><p role="status"><strong>{scenarios.counts.ready_on_current_evidence} ready</strong> · {scenarios.counts.conditional_verification_required} conditional · {scenarios.counts.blocked} blocked</p>{scenarios.enumerationTruncated&&<p className="notice">The candidate or combination evaluation limit was reached; this is not exhaustive.</p>}{scenarios.resultLimited&&<p className="notice">Some evaluated alternatives were omitted by the five-result presentation limit.</p>}<div className="scenario-grid">{scenarios.scenarios.map(scenario=><article className={`scenario-card scenario-${scenario.status}`} key={scenario.id}><h4>{scenario.objectives.length?scenario.objectives.map(value=>value.replaceAll('_',' ')).join(' · '):'Supported alternative'}</h4><p><strong>{scenario.status.replaceAll('_',' ')}</strong></p><p className="scenario-id">{scenario.id}</p><ul>{scenario.selections.map(selection=><li key={`${selection.product.provider}:${selection.product.id}`}><strong>Product: {selection.productTitle}</strong> <span className="scenario-id">({selection.product.id})</span> · offer {selection.offer?.id??'unresolved'} · quantity {selection.quantity??'unresolved'} · merchant {selection.merchant?.id??'unresolved'}</li>)}</ul><p>Whole-plan lines: {scenario.selections.length}</p><dl><div><dt>Merchants</dt><dd>{scenario.evaluation.merchantCount}</dd></div><div><dt>Required failures / unknowns</dt><dd>{scenario.evaluation.mandatoryFailures+scenario.evaluation.exclusionViolations} / {scenario.evaluation.mandatoryUnknowns}</dd></div><div><dt>Preferences satisfied / unknown</dt><dd>{scenario.evaluation.preferencesSatisfied} / {scenario.evaluation.preferencesUnknown}</dd></div><div><dt>Cost completeness</dt><dd>{scenario.evaluation.costAssessment?.completeness.replaceAll('_',' ')??'unknown'}</dd></div><div><dt>Budget</dt><dd>{scenario.evaluation.budget?.status??'not specified'}</dd></div></dl>{scenario.evaluation.costAssessment?.currencyTotals.map(total=><p key={total.currency}>{total.exactLandedTotal?<>Exact landed total: {formatMoney(total.exactLandedTotal)}</>:<>Supported lower bound: {formatMoney(total.knownLowerBound)}{total.upperBound?` · upper bound ${formatMoney(total.upperBound)}`:' · exact total unresolved'}</>}</p>)}{scenario.evaluation.supplierAssessments?.map(supplier=><p key={supplier.supplierId}>Supplier: {supplier.name} · {supplier.standing} · quotation {supplier.quotationState} · reliability {supplier.reliability} · active risks {supplier.activeRisks.length}</p>)}{scenario.blockingIssueIds.length>0&&<p className="unresolved">Blocking issues: {scenario.blockingIssueIds.length}</p>}{scenario.verificationIssueIds.length>0&&<p className="unresolved">Verification gaps: {scenario.verificationIssueIds.length}</p>}{scenario.reasons.map(reason=><p className="unresolved" key={reason}>{reason}</p>)}{scenario.tradeoffs.map(reason=><p key={reason}>{reason}</p>)}<button disabled={scenario.status!=='ready_on_current_evidence'} onClick={()=>{const result=onApplyScenario({scenarioId:scenario.id,basisFingerprint:scenario.basisFingerprint});setScenarioFeedback(result.ok?{kind:'status',message:`Scenario applied. Plan revision ${result.value.revision}.`}:{kind:'alert',message:result.message})}}>{scenario.status==='ready_on_current_evidence'?'Apply this scenario':'Resolve evidence before applying'}</button></article>)}</div></>}
  {scenarioFeedback&&<p role={scenarioFeedback.kind} aria-live="polite" className={scenarioFeedback.kind==='alert'?'notice error':'notice'}>{scenarioFeedback.message}</p>}
 </section>
}

export function DecisionWorkspace({ products, evidenceProducts, evidenceEntries, evidenceRefresh, plan, planEvaluation, comparison, comparisonIds, pendingProposal, activeView='compare', onClearComparison, onAddProduct, onRemoveLine, onSetQuantity, onSelectOffer, onRebase, onRefreshEvidence }: {
  goal: PurchaseGoal; products: ProductCluster[]; evidenceProducts: ProductCluster[]; plan:PurchasePlan;planEvaluation:PlanEvaluation;comparison?:ProductComparison;comparisonIds: ProviderIdentity[]; onClearComparison: () => void
  pendingProposal:boolean;activeView?:'compare'|'plan';evidenceEntries:ProductEvidenceEntry[];evidenceRefresh:Record<string,EvidenceRefreshState>;onAddProduct:(identity:ProviderIdentity)=>void;onRemoveLine:(lineId:string)=>void;onSetQuantity:(lineId:string,quantity:number)=>void;onSelectOffer:(lineId:string,offer?:ProviderIdentity)=>void;onRebase:()=>void;onRefreshEvidence:(identity:ProviderIdentity)=>Promise<ApplicationResult<ProductEvidenceEntry>>
}) {
  const componentAmount=(component:NonNullable<PlanEvaluation['costAssessment']>['recurring'][number])=>component.knowledge.kind==='exact'?formatMoney(component.knowledge.amount):component.knowledge.kind==='range'?`${formatMoney(component.knowledge.minimum)}–${formatMoney(component.knowledge.maximum)}`:'amount unresolved'
  const selectedTitles = comparisonIds.map((identity) => products.find((product) => sameProviderIdentity(product.identity, identity))?.title.value ?? identity.id)
  return activeView==='compare'?<section className="decision-workspace" id="stage-compare" aria-labelledby="decision-title">
    <div className="compare-view"><p className="eyebrow">Evidence differences</p><h2 id="decision-title">Compare what is known</h2>
    <p>Comparison uses known evaluation dimensions without a score. Adding a product remains your decision.</p>
    {evidenceEntries.length>0&&<details className="comparison-panel retained-evidence"><summary><strong id="retained-evidence-title">Retained evidence and refresh controls</strong></summary><p>Observation time records when CoSource accepted the provider response, not when the provider published it.</p><ul>{evidenceEntries.map(entry=>{const refresh=evidenceRefresh[providerIdentityKey(entry.subject)];return <li key={providerIdentityKey(entry.subject)}><strong>Evidence for {entry.current.product.title.value}</strong> · Last observed {new Date(entry.current.observedAt).toLocaleString()} · {entry.history.length} superseded observation{entry.history.length===1?'':'s'} {refresh?.status==='error'&&<span className="notice error" role="alert">Refresh failed. Last accepted evidence preserved. {refresh.error?.message}</span>}<button className="secondary" disabled={refresh?.status==='loading'} onClick={()=>void onRefreshEvidence(entry.subject)}>{refresh?.status==='loading'?'Refreshing…':'Refresh evidence'}</button></li>})}</ul></details>}
    <div className="selection-guidance" role="status"><strong>{comparisonIds.length} of 2 selected</strong>{comparisonIds.length === 0 && <span>Select two result candidates to compare their known evidence.</span>}{comparisonIds.length === 1 && <span>{selectedTitles[0]} is selected. Select one more result candidate.</span>}{comparisonIds.length === 2 && <span>Comparison is ready. Review the evidence outcome, then choose whether to add a product.</span>}</div>
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
    </section>}</div></section>:<section className="decision-workspace plan-panel" id="stage-plan" aria-labelledby="plan-title">
      <div className="workspace-head"><div><h2 id="plan-title">Purchase plan</h2><span>Plan revision {plan.revision} · Goal revision {plan.goalRevision}</span></div>{planEvaluation.stale && <button onClick={onRebase}>Re-evaluate with current goal</button>}</div>
      {planEvaluation.stale && <p className="stale-warning" role="alert">The goal changed after this plan was assembled. Existing evaluation is stale.</p>}
      <p>Status: <strong>{planEvaluation.status.replaceAll('_', ' ')}</strong></p>
      {planEvaluation.readiness&&<div className={`notice ${planEvaluation.readiness==='ready_on_current_evidence'?'':'error'}`}><strong>Decision readiness: {planEvaluation.readiness.replaceAll('_',' ')}</strong>{planEvaluation.readinessReasons?.map(reason=><p key={reason}>{reason}</p>)}</div>}
      {planEvaluation.budget && <div className={`plan-budget budget-${planEvaluation.budget.status}`}>
        <h4>Plan budget: {planEvaluation.budget.status}</h4><p>{planEvaluation.budget.reason}</p>
        <p>Goal budget: {formatMoney(planEvaluation.budget.goalBudget)}{planEvaluation.budget.comparableSubtotal && <> · Safely known comparable subtotal: {formatMoney(planEvaluation.budget.comparableSubtotal)}</>}</p>
      </div>}
      <p>Known conflicts: {planEvaluation.mandatoryFailures + planEvaluation.exclusionViolations} · Unverified requirements: {planEvaluation.mandatoryUnknowns} · Preferences satisfied / unknown: {planEvaluation.preferencesSatisfied} / {planEvaluation.preferencesUnknown}</p>
      {plan.lines.length === 0 ? <p className="plan-next">No products added. A product enters the plan only when you choose <strong>Add to purchase plan</strong> from the human comparison.</p> : <><p className="plan-next">Next: review agent activity and any bounded proposals. Human approval remains required.</p><div className="plan-lines">{plan.lines.map((line) => {
        const product = evidenceProducts.find((item) => sameProviderIdentity(item.identity, line.product))
        return <article key={line.id}><div><h4>{line.productTitle}</h4>
          <label>Quantity <input type="number" min="1" max="100000" value={line.quantity ?? 1} onChange={(event) => { const quantity=Number(event.target.value); if(Number.isInteger(quantity)&&quantity>=1&&quantity<=100_000)onSetQuantity(line.id,quantity) }}/></label>
          {product && product.offers.length > 1 && <label>Merchant offer <select value={line.selectedOffer ? providerIdentityKey(line.selectedOffer) : ''} onChange={(event) => { const offer = product.offers.find((item) => providerIdentityKey(item.identity) === event.target.value); onSelectOffer(line.id, offer?.identity) }}>
            <option value="">Not selected</option>{product.offers.map((offer) => <option key={providerIdentityKey(offer.identity)} value={providerIdentityKey(offer.identity)}>{offer.merchant?.name || offer.merchant?.domain || offer.identity.id} — {formatMoney(offer.price)}</option>)}
          </select></label>}
          {product && product.offers.length === 1 && <p className="muted">Sole returned offer available for evidence.</p>}
        </div><button className="remove" onClick={() => onRemoveLine(line.id)}>Remove</button></article>
      })}</div></>}
      <div className="plan-summary"><p>Selected merchants: {planEvaluation.merchantCount}</p><p>Currencies: {planEvaluation.currencies.join(', ') || 'None selected'}</p>
        <h4>Cost evidence</h4>{planEvaluation.costAssessment&&<p><strong>Cost completeness: {planEvaluation.costAssessment.completeness.replaceAll('_',' ')}</strong></p>}{planEvaluation.costAssessment?.currencyTotals.length ? planEvaluation.costAssessment.currencyTotals.map((total) => <div className="cost-currency" key={total.currency}><strong>Listing/base-price subtotal: {formatMoney(total.baseSubtotal)}</strong><strong>Conservative landed-cost lower bound: {formatMoney(total.knownLowerBound)}</strong>{total.exactLandedTotal?<strong>Exact landed total: {formatMoney(total.exactLandedTotal)}</strong>:<span className="unresolved">Exact landed total is not proven.</span>}<details><summary>Detailed cost coverage</summary><span>Known additions: {formatMoney(total.knownAdditions)}</span><span>Known deductions: {formatMoney(total.knownDeductions)}</span>{total.upperBound&&<span>Supported upper bound: {formatMoney(total.upperBound)}</span>}</details></div>) : <p className="muted">No safely calculable cost evidence.</p>}
        {planEvaluation.costAssessment?.recurring.length?<div className="unresolved"><strong>Recurring costs (excluded from one-time totals)</strong>{planEvaluation.costAssessment.recurring.map(item=><p key={`${item.evidence.source}:${item.id}`}>{item.label??item.category}: {componentAmount(item)}{item.applicability==='unknown'?' · may apply; applicability unresolved':''}</p>)}</div>:null}
        {planEvaluation.costAssessment?.unresolved.length?<p className="unresolved">Usage-based, unknown, or otherwise unresolved costs remain outside exact totals.</p>:null}
        {planEvaluation.unresolvedCosts.map((note) => <p className="unresolved" key={note}>{note}</p>)}
        <p className="muted">Merchant checkout is the final verification point for delivery, tax, duty, fees, discounts, and the payable amount.</p>
      </div>
      {pendingProposal && <a className="button-link review-route" href="#stage-review">Review pending agent proposal</a>}
    </section>
}
