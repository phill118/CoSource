import {describe,expect,it,vi} from 'vitest'
import {COMMERCE_PROVIDERS,type ProductCluster} from '../commerce/domain/commerce'
import {createCoSourceApplication} from './cosource-application'
import {createApplicationTools} from '../webmcp/application-tools'

const provider=COMMERCE_PROVIDERS.shopifyGlobalCatalog,provenance={kind:'provider_explicit' as const,provider}
const market={country:'US',currency:'USD',language:'en'}
const product=(id:string):ProductCluster=>({identity:{provider,id},title:{value:id.toUpperCase(),provenance},media:[],offers:[{identity:{provider,id:`${id}-offer`},title:{value:id,provenance},price:{minorAmount:1000,currency:'USD'},availability:{state:'available',basis:'catalog_signal',provenance},selectedOptions:[],media:[],correlations:[],provenance}],offerCompleteness:'featured_only',featuredOfferId:`${id}-offer`,provenance})

function fixture(){
  let n=0
  const products=[product('a'),product('b')]
  const search=vi.fn(async()=>({products,messages:[],pagination:{hasMore:false}}))
  const productLookup=vi.fn(async(input:{identity:{id:string}})=>({product:products.find(item=>item.identity.id===input.identity.id)!,selectedOptions:[],messages:[]}))
  const application=createCoSourceApplication({market,catalog:{search,product:productLookup},makeId:()=>`id-${++n}`,now:()=>`2026-09-02T00:00:0${n}Z`})
  application.editGoal({summary:'Equip a team',searchFocus:'generic products'})
  application.commitGoalDraft()
  return{application,search,productLookup,products}
}

describe('canonical CoSource application kernel',()=>{
  it('owns the complete active-goal sourcing workflow and keeps exploratory search distinct',async()=>{
    const{application,search}=fixture()
    const goalSource=await application.sourceCandidatesForActiveGoal()
    expect(goalSource).toMatchObject({ok:true,value:{strategy:{query:'generic products'}}})
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({query:'generic products',country:'US',currency:'USD',available:true,shipsTo:'US'}))
    expect(application.getSnapshot().humanDiscovery.strategy?.query).toBe('generic products')
    await application.searchCandidates({query:'desk lamps'})
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({query:'desk lamps',country:'US',currency:'USD'}))
    expect(application.getSnapshot().humanDiscovery.strategy).toBeUndefined()
  })

  it('enforces the session market for WebMCP sourcing and records one authoritative activity',async()=>{
    const{application,search}=fixture()
    const sourceTool=createApplicationTools(application).find(tool=>tool.name==='search_products')!
    const spy=vi.spyOn(application,'sourceCandidatesForAgent')
    await sourceTool.execute({query:'generic products',country:'US',currency:'USD'})
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({market:{country:'US',currency:'USD'}}))
    expect(application.getSnapshot().agentDiscovery.candidates).toHaveLength(2)
    expect(application.getSnapshot().activities.filter(activity=>activity.kind==='agent_search')).toHaveLength(1)
    const mismatch=await sourceTool.execute({query:'generic products',country:'GB',currency:'GBP'})
    expect(mismatch).toMatchObject({ok:false,error:{code:'invalid_input'}})
    expect(search).toHaveBeenCalledTimes(1)
    expect(application.getSnapshot().activities.filter(activity=>activity.kind==='agent_search')).toHaveLength(2)
  })

  it('propagates canonical provider identity and explicit session market through inspection',async()=>{
    const{application,productLookup,products}=fixture()
    await application.searchCandidates({query:'generic products'})
    await application.inspectCandidate(products[0]!.identity)
    expect(productLookup).toHaveBeenCalledWith({identity:products[0]!.identity,market})
  })

  it('promotes human and agent candidates into one retained registry and shares evaluation/comparison',async()=>{
    const{application,products}=fixture()
    await application.sourceCandidatesForAgent({query:'generic products',market})
    expect(application.getSnapshot().retainedProducts).toHaveLength(0)
    application.retainCandidate(products[0]!.identity)
    application.toggleComparison(products[1]!.identity)
    expect(application.getSnapshot().retainedProducts.map(item=>item.identity.id).sort()).toEqual(['a','b'])
    expect(application.evaluateCandidate(products[0]!.identity).ok).toBe(true)
    expect(application.compareCandidates(products[0]!.identity,products[1]!.identity).ok).toBe(true)
  })

  it('bounds aggregate cost overflow for application and WebMCP evaluation',async()=>{
    const{application,products}=fixture(),candidate=products[0]!,selected=candidate.offers[0]!
    selected.costComponents=[{id:'fee',category:'mandatory_fee',label:'Mandatory fee',effect:'addition',basis:'per_line',applicability:'applies',knowledge:{kind:'exact',amount:{minorAmount:Number.MAX_SAFE_INTEGER,currency:'USD'}},timing:'one_time',evidence:{strength:'source_explicit',source:'fixture'}}]
    selected.oneTimeCostCoverage={status:'complete',evidence:{strength:'source_explicit',source:'fixture'}}
    await application.searchCandidates({query:'generic products'});application.retainCandidate(candidate.identity)
    const result=application.evaluateCandidate(candidate.identity);expect(result).toMatchObject({ok:true,value:{costAssessment:{completeness:'incomplete'}}})
    const tool=createApplicationTools(application).find(item=>item.name==='evaluate_product')!,output=await tool.execute({product:candidate.identity})
    expect(output).toMatchObject({ok:true,data:{costAssessment:{completeness:'incomplete'}}});expect(JSON.stringify(output)).not.toMatch(/stack|safe integer range/i)
  })

  it('keeps verification-only coverage incomplete in application and WebMCP plan output',async()=>{
    const{application,products}=fixture(),candidate=products[0]!,selected=candidate.offers[0]!
    selected.oneTimeCostCoverage={status:'complete',evidence:{strength:'source_inferred',source:'fixture'}}
    await application.searchCandidates({query:'generic products'});application.retainCandidate(candidate.identity)
    const state=application.getSnapshot(),proposal=application.createPlanProposal({planId:state.plan.id,planRevision:state.plan.revision,goalId:state.activeGoal!.id,goalRevision:state.activeGoal!.revision,operations:[{type:'add_retained_product',product:candidate.identity}]});expect(proposal.ok).toBe(true);if(!proposal.ok)return;application.approvePlanProposal(proposal.value.id)
    expect(application.evaluatePurchasePlan()).toMatchObject({ok:true,value:{costAssessment:{completeness:'incomplete'},readiness:'insufficient_evidence'}})
    const tool=createApplicationTools(application).find(item=>item.name==='evaluate_purchase_plan')!,output=await tool.execute({});expect(output).toMatchObject({ok:true,data:{costAssessment:{completeness:'incomplete'}}});expect(JSON.stringify(output)).not.toMatch(/stack|budget satisfied/i)
  })

  it('owns proposal creation, approval and rejection activities with plan revisions',async()=>{
    const{application,products}=fixture()
    await application.searchCandidates({query:'generic products'})
    application.retainCandidate(products[0]!.identity)
    const initial=application.getSnapshot()
    const created=application.createPlanProposal({planId:initial.plan.id,planRevision:initial.plan.revision,goalId:initial.activeGoal!.id,goalRevision:initial.activeGoal!.revision,operations:[{type:'add_retained_product',product:products[0]!.identity}]})
    expect(created.ok).toBe(true)
    expect(application.getSnapshot().plan.lines).toHaveLength(0)
    if(!created.ok)return
    const applied=application.approvePlanProposal(created.value.id)
    expect(applied.ok&&applied.value?.lines).toHaveLength(1)
    expect(application.evaluatePurchasePlan().ok).toBe(true)
    const current=application.getSnapshot(),second=application.createPlanProposal({planId:current.plan.id,planRevision:current.plan.revision,goalId:current.activeGoal!.id,goalRevision:current.activeGoal!.revision,operations:[{type:'remove_plan_line',lineId:current.plan.lines[0]!.id}]})
    expect(second.ok).toBe(true)
    if(second.ok)expect(application.rejectPlanProposal(second.value.id)).toMatchObject({ok:true,value:{status:'rejected'}})
    expect(application.getSnapshot().activities.map(activity=>activity.kind)).toEqual(['proposal_rejected','agent_proposal_created','proposal_applied','agent_proposal_created','goal_committed'])
  })
})
