import type { ProductCluster } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import type { PurchasePlan } from '../planning/domain/purchase-plan'
import type { PlanChangeProposal } from '../proposals/domain/plan-change-proposal'

export interface WebMCPState { goal?:PurchaseGoal; plan:PurchasePlan; retainedProducts:ProductCluster[]; proposals?:PlanChangeProposal[];agentCandidates?:ProductCluster[] }
export interface ModelContextLike { registerTool(tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}):Promise<void> }
