import type { ProductCluster } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import type { PurchasePlan } from '../planning/domain/purchase-plan'

export interface WebMCPState { goal?:PurchaseGoal; plan:PurchasePlan; retainedProducts:ProductCluster[] }
export interface WebMCPActivity { id:number; timestamp:string; toolName:string; outcome:'success'|'failure'; summary:string }
export interface ModelContextLike { registerTool(tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}):Promise<void> }
