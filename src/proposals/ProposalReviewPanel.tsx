import type { ProductCluster } from '../commerce/domain/commerce'
import { findByProviderIdentity } from '../commerce/domain/provider-identity'
import { formatMoney } from '../commerce/domain/money-display'
import type { PlanEvaluation, PurchasePlan } from '../planning/domain/purchase-plan'
import type { PlanChangeProposal, ProposalOperation } from './domain/plan-change-proposal'
import type {ApplicationResult} from '../application/cosource-application'
import './proposals.css'

function evaluation(value:PlanEvaluation){return <dl><div><dt>Status</dt><dd>{value.status.replaceAll('_',' ')}</dd></div><div><dt>Known conflicts</dt><dd>{value.mandatoryFailures+value.exclusionViolations}</dd></div><div><dt>Unknown mandatory conditions</dt><dd>{value.mandatoryUnknowns}</dd></div><div><dt>Currencies</dt><dd>{value.currencies.join(', ')||'None'}</dd></div><div><dt>Known subtotals</dt><dd>{value.knownSubtotals.map(total=>formatMoney(total)).join(', ')||'None safely calculable'}</dd></div><div><dt>Plan budget</dt><dd>{value.budget?.status??'No budget supplied'}</dd></div></dl>}
function operationText(operation:ProposalOperation,plan:PurchasePlan,products:ProductCluster[]){
  if(operation.type==='add_retained_product')return `Add retained product: ${findByProviderIdentity(products,operation.product)?.title.value??'Unavailable product'}`
  const line='lineId'in operation?plan.lines.find(item=>item.id===operation.lineId):undefined
  if(operation.type==='remove_plan_line')return `Remove product: ${line?.productTitle??operation.lineId}`
  if(operation.type==='set_quantity')return `Change quantity: ${line?.quantity??1} → ${operation.quantity}`
  if(operation.type==='rebase_to_current_goal')return 'Rebase plan to the current validated human goal'
  if(!operation.offer)return `Clear merchant offer: ${line?.productTitle??operation.lineId}`
  const product=line&&findByProviderIdentity(products,line.product),offer=product&&findByProviderIdentity(product.offers,operation.offer)
  return `Select merchant offer: ${offer?.merchant?.name||offer?.merchant?.domain||offer?.identity.id||'Unavailable offer'}${offer?` — ${formatMoney(offer.price)}`:''}`
}
export function ProposalReviewPanel({proposals,plan,products,onApprove,onReject,getReview}:{proposals:PlanChangeProposal[];plan:PurchasePlan;products:ProductCluster[];onApprove:(id:string)=>void;onReject:(id:string)=>void;getReview:(id:string)=>ApplicationResult<{status:PlanChangeProposal['status'];before:PlanEvaluation;after?:PlanEvaluation}>}){
  return <section className="proposal-review" aria-labelledby="proposal-title"><p className="eyebrow">4 · Human approval</p><h2 id="proposal-title">Agent proposals</h2><p>Agents can propose bounded plan changes. Only you can approve and apply them.</p>
    {proposals.length===0?<p className="muted">No agent proposals this session.</p>:proposals.map(proposal=>{const review=getReview(proposal.id),status=review.ok?review.value.status:proposal.status
      return <article key={proposal.id} className={`proposal proposal-${status}`}><header><div><strong>Agent proposal</strong><h3>{proposal.id}</h3></div><span>{status}</span></header><p>{proposal.reason||'No reason supplied.'}</p><p>Current plan revision {plan.revision} · Target revision {proposal.expectedPlanRevision}</p>
        {status==='stale'&&<p role="alert" className="stale-warning">This proposal is stale because the plan or goal changed.</p>}
        <ol>{proposal.operations.map((operation,index)=><li key={`${proposal.id}-${index}`}>{operationText(operation,plan,products)}</li>)}</ol>
        {status==='pending'&&review.ok&&review.value.after&&<div className="proposal-preview"><section><h4>Before</h4>{evaluation(review.value.before)}</section><section><h4>After preview</h4>{evaluation(review.value.after)}</section></div>}
        {proposal.error&&<p role="alert" className="stale-warning">{proposal.error}</p>}
        {status==='pending'&&<div className="proposal-actions"><button type="button" onClick={()=>onApprove(proposal.id)}>Approve and apply</button><button type="button" className="secondary" onClick={()=>onReject(proposal.id)}>Reject</button></div>}
      </article>})}
  </section>
}
