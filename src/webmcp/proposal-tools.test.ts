import {describe,expect,it} from 'vitest'
import {COMMERCE_PROVIDERS,type ProductCluster} from '../commerce/domain/commerce'
import {createPurchaseGoal} from '../goals/domain/purchase-goal'
import {createPurchasePlan} from '../planning/domain/purchase-plan'
import type {PlanChangeProposal} from '../proposals/domain/plan-change-proposal'
import {createProposalTools,WEBMCP_TOOL_NAMES} from './tools'
import type {WebMCPState} from './types'
const provider=COMMERCE_PROVIDERS.shopifyGlobalCatalog,provenance={kind:'provider_explicit' as const,provider},product:ProductCluster={identity:{provider,id:'p'},title:{value:'P',provenance},media:[],offers:[],offerCompleteness:'provider_returned_unknown',provenance},goal=createPurchaseGoal({id:'g',summary:'P',requirements:[],preferences:[],exclusions:[]})
describe('WebMCP proposal tools',()=>{it('creates proposal state but never applies and registers no direct apply tool',async()=>{const state:WebMCPState={goal,plan:createPurchasePlan('plan','g',0),retainedProducts:[product],proposals:[]},created:PlanChangeProposal[]=[];const tools=createProposalTools(()=>state,p=>created.push(p),()=>{},()=> 'p1',()=> '2026-08-31T00:00:00Z');expect(tools.map(t=>t.name)).toEqual(['propose_plan_changes','get_plan_proposals']);expect(tools[0]?.annotations?.readOnlyHint).toBe(false);expect(tools[1]?.annotations?.readOnlyHint).toBe(true);const before=state.plan;const result=await tools[0]!.execute({planId:'plan',planRevision:0,goalId:'g',goalRevision:0,operations:[{type:'add_retained_product',product:product.identity}],reason:'Add P'}) as {ok:boolean};expect(result.ok).toBe(true);expect(created).toHaveLength(1);expect(state.plan).toBe(before);expect(WEBMCP_TOOL_NAMES.join(' ')).not.toContain('apply_plan_changes')})})
