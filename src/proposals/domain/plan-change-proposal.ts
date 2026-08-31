import type { ProviderIdentity } from '../../commerce/domain/commerce'

export type ProposalStatus='pending'|'approved'|'rejected'|'stale'|'applied'|'failed'
export type ProposalOperation=
  | {type:'add_retained_product';product:ProviderIdentity;lineId:string}
  | {type:'remove_plan_line';lineId:string}
  | {type:'set_quantity';lineId:string;quantity:number}
  | {type:'select_merchant_offer';lineId:string;offer?:ProviderIdentity}
  | {type:'rebase_to_current_goal'}

export interface PlanChangeProposal {
  id:string;status:ProposalStatus;createdAt:string;source:'agent_webmcp'
  planId:string;expectedPlanRevision:number;expectedGoalId:string;expectedGoalRevision:number
  reason?:string;operations:ProposalOperation[];error?:string
  appliedPlanRevision?:number;reviewedAt?:string
}

export interface ProposalContext {planId:string;planRevision:number;goalId?:string;goalRevision?:number}
