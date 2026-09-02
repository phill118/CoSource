import { COMMERCE_PROVIDERS, type ProductCluster, type ProviderIdentity } from '../commerce/domain/commerce'
import { findByProviderIdentity, sameProviderIdentity } from '../commerce/domain/provider-identity'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import { PLAN_QUANTITY_MAX, type PurchasePlan } from '../planning/domain/purchase-plan'
import { addProductToPlan, rebasePlanToGoal, removePlanLine, selectPlanLineOffer, setPlanLineQuantity } from '../planning/mutate-plan'
import type { PlanChangeProposal, ProposalContext, ProposalOperation, ProposalStatus } from './domain/plan-change-proposal'

export const MAX_PROPOSAL_OPERATIONS=20
const MAX_ID=500,MAX_REASON=500,providers=Object.values(COMMERCE_PROVIDERS)
export interface ProposalState {goal?:PurchaseGoal;plan:PurchasePlan;retainedProducts:ProductCluster[]}
export type ProposalResult={ok:true;proposal:PlanChangeProposal}|{ok:false;code:string;message:string;context:ProposalContext}

function context(state:ProposalState):ProposalContext{return{planId:state.plan.id,planRevision:state.plan.revision,goalId:state.goal?.id,goalRevision:state.goal?.revision}}
function record(value:unknown):Record<string,unknown>|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined}
function identity(value:unknown):ProviderIdentity|undefined{const item=record(value);if(!item||Object.keys(item).some(key=>!['provider','id'].includes(key)))return;return typeof item.provider==='string'&&providers.includes(item.provider as typeof providers[number])&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=MAX_ID?{provider:item.provider as ProviderIdentity['provider'],id:item.id}:undefined}
function boundedId(value:unknown){return typeof value==='string'&&value.length>0&&value.length<=MAX_ID?value:undefined}

export function proposalEffectiveStatus(proposal:PlanChangeProposal,state:ProposalState):ProposalStatus{
  if(proposal.status!=='pending')return proposal.status
  return proposal.planId!==state.plan.id||proposal.expectedPlanRevision!==state.plan.revision||proposal.expectedGoalId!==state.goal?.id||proposal.expectedGoalRevision!==state.goal?.revision?'stale':'pending'
}

function normalizeOperation(value:unknown,state:ProposalState,proposalId:string,index:number):ProposalOperation|undefined{
  const item=record(value);if(!item||typeof item.type!=='string')return
  if(item.type==='add_retained_product'&&Object.keys(item).every(key=>['type','product'].includes(key))){const product=identity(item.product);if(!product||!findByProviderIdentity(state.retainedProducts,product)||state.plan.lines.some(line=>sameProviderIdentity(line.product,product)))return;return{type:item.type,product,lineId:`proposal-${proposalId}-${index+1}`}}
  if(item.type==='remove_plan_line'&&Object.keys(item).every(key=>['type','lineId'].includes(key))){const lineId=boundedId(item.lineId);if(!lineId||!state.plan.lines.some(line=>line.id===lineId))return;return{type:item.type,lineId}}
  if(item.type==='set_quantity'&&Object.keys(item).every(key=>['type','lineId','quantity'].includes(key))){const lineId=boundedId(item.lineId);if(!lineId||!state.plan.lines.some(line=>line.id===lineId)||!Number.isInteger(item.quantity)||Number(item.quantity)<1||Number(item.quantity)>PLAN_QUANTITY_MAX)return;return{type:item.type,lineId,quantity:Number(item.quantity)}}
  if(item.type==='select_merchant_offer'&&Object.keys(item).every(key=>['type','lineId','offer'].includes(key))){const lineId=boundedId(item.lineId),line=state.plan.lines.find(candidate=>candidate.id===lineId);if(!line)return; if(item.offer===undefined)return{type:item.type,lineId:line.id};const offer=identity(item.offer),product=findByProviderIdentity(state.retainedProducts,line.product);if(!offer||!product||!findByProviderIdentity(product.offers,offer))return;return{type:item.type,lineId:line.id,offer}}
  if(item.type==='rebase_to_current_goal'&&Object.keys(item).length===1&&state.goal)return{type:item.type}
}

export function createPlanChangeProposal(input:unknown,state:ProposalState,makeId:()=>string,now:()=>string):ProposalResult{
  const current=context(state),item=record(input)
  if(!item||Object.keys(item).some(key=>!['planId','planRevision','goalId','goalRevision','operations','reason'].includes(key)))return{ok:false,code:'invalid_input',message:'Only bounded proposal fields are accepted.',context:current}
  if(!state.goal)return{ok:false,code:'no_validated_goal',message:'A current validated goal is required.',context:current}
  if(item.planId!==state.plan.id||item.planRevision!==state.plan.revision||item.goalId!==state.goal.id||item.goalRevision!==state.goal.revision)return{ok:false,code:'stale_revision',message:'The supplied plan or goal revision is stale. Re-read current state.',context:current}
  if(item.reason!==undefined&&(typeof item.reason!=='string'||item.reason.trim().length<1||item.reason.length>MAX_REASON))return{ok:false,code:'invalid_reason',message:`Reason must be 1 to ${MAX_REASON} characters.`,context:current}
  if(!Array.isArray(item.operations)||item.operations.length<1||item.operations.length>MAX_PROPOSAL_OPERATIONS)return{ok:false,code:'invalid_operations',message:`Provide 1 to ${MAX_PROPOSAL_OPERATIONS} operations.`,context:current}
  const id=makeId();const operations=item.operations.map((operation,index)=>normalizeOperation(operation,state,id,index))
  if(operations.some(operation=>!operation))return{ok:false,code:'invalid_operation',message:'An operation is invalid for the retained evidence or current plan.',context:current}
  const proposal:PlanChangeProposal={id,status:'pending',createdAt:now(),source:'agent_webmcp',planId:state.plan.id,expectedPlanRevision:state.plan.revision,expectedGoalId:state.goal.id,expectedGoalRevision:state.goal.revision,reason:item.reason?.toString().trim(),operations:operations as ProposalOperation[]}
  const preview=applyProposalOperations(proposal,state);if(!preview.ok)return{ok:false,code:'invalid_operation',message:preview.error,context:current}
  return{ok:true,proposal}
}

export function applyProposalOperations(proposal:PlanChangeProposal,state:ProposalState):{ok:true;plan:PurchasePlan}|{ok:false;error:string}{
  let plan=state.plan
  try{for(const operation of proposal.operations){const before=plan
    if(operation.type==='add_retained_product'){const product=findByProviderIdentity(state.retainedProducts,operation.product);if(!product)return{ok:false,error:'A retained product is no longer available.'};const base=plan.lines.length===0&&state.goal?{...plan,goalId:state.goal.id,goalRevision:state.goal.revision}:plan;plan=addProductToPlan(base,product,operation.lineId)}
    else if(operation.type==='remove_plan_line')plan=removePlanLine(plan,operation.lineId)
    else if(operation.type==='set_quantity')plan=setPlanLineQuantity(plan,operation.lineId,operation.quantity)
    else if(operation.type==='select_merchant_offer')plan=selectPlanLineOffer(plan,operation.lineId,operation.offer,state.retainedProducts)
    else {if(!state.goal)return{ok:false,error:'The current validated goal is unavailable.'};plan=rebasePlanToGoal(plan,state.goal.id,state.goal.revision)}
    if(plan===before)return{ok:false,error:`Operation ${operation.type} cannot change the current plan.`}
  }}catch{return{ok:false,error:'An operation failed authoritative plan validation.'}}
  return{ok:true,plan}
}

export function approveProposal(proposal:PlanChangeProposal,state:ProposalState,now:()=>string):{proposal:PlanChangeProposal;plan?:PurchasePlan}{
  if(proposalEffectiveStatus(proposal,state)==='stale')return{proposal:{...proposal,status:'stale',reviewedAt:now(),error:'This proposal is stale because the plan or goal changed.'}}
  if(proposal.status!=='pending')return{proposal}
  const result=applyProposalOperations(proposal,state);return result.ok?{proposal:{...proposal,status:'applied',reviewedAt:now(),appliedPlanRevision:result.plan.revision},plan:result.plan}:{proposal:{...proposal,status:'failed',reviewedAt:now(),error:result.error}}
}

export function rejectProposal(proposal:PlanChangeProposal,now:()=>string){return proposal.status==='pending'?{...proposal,status:'rejected' as const,reviewedAt:now()}:proposal}
