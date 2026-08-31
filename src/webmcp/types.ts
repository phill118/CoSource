import type { ProductCluster } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import type { PurchasePlan } from '../planning/domain/purchase-plan'
import type { PlanChangeProposal } from '../proposals/domain/plan-change-proposal'

export interface WebMCPState { goal?:PurchaseGoal; plan:PurchasePlan; retainedProducts:ProductCluster[]; proposals?:PlanChangeProposal[] }
export interface WebMCPActivity { id:number; timestamp:string; kind:'read_tool_call'|'agent_proposal_created'|'proposal_rejected'|'proposal_applied'|'proposal_stale'; toolName:string; outcome:'success'|'failure'; summary:string }
export interface ModelContextLike { registerTool(tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}):Promise<void> }
