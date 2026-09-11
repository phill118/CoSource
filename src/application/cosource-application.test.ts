import {describe,expect,it,vi} from 'vitest'
import {COMMERCE_PROVIDERS,type ProductCluster} from '../commerce/domain/commerce'
import {createCoSourceApplication} from './cosource-application'
import {createApplicationTools} from '../webmcp/application-tools'

const provider=COMMERCE_PROVIDERS.shopifyGlobalCatalog,provenance={kind:'provider_explicit' as const,provider}
const market={country:'US',currency:'USD',language:'en'}
const product=(id:string):ProductCluster=>({identity:{provider,id},title:{value:id.toUpperCase(),provenance},media:[],offers:[{identity:{provider,id:`${id}-offer`},title:{value:id,provenance},merchant:{identity:{provider,id:`merchant-${id}`},name:`Merchant ${id}`,policyLinks:[],provenance},price:{minorAmount:1000,currency:'USD'},availability:{state:'available',basis:'catalog_signal',provenance},selectedOptions:[],media:[],correlations:[],provenance}],offerCompleteness:'featured_only',featuredOfferId:`${id}-offer`,provenance})

function fixture(){
  let n=0
  const products=[product('a'),product('b')]
  const search=vi.fn(async()=>({products,messages:[],pagination:{hasMore:false}}))
  const productLookup=vi.fn(async(input:{identity:{id:string}})=>({product:products.find(item=>item.identity.id===input.identity.id)!,selectedOptions:[],messages:[]}))
  const application=createCoSourceApplication({market,catalog:{search,product:productLookup},makeId:()=>`id-${++n}`,now:()=>`2026-09-02T00:00:${n.toString().padStart(2,'0')}Z`})
  application.editGoal({summary:'Equip a team',searchFocus:'generic products'})
  application.commitGoalDraft()
  return{application,search,productLookup,products}
}

describe('canonical CoSource application kernel',()=>{
  it('retains supplier truth only by explicit exact merchant action and does not let search create it',async()=>{const{application,products}=fixture();await application.searchCandidates({query:'products'});expect(application.getSnapshot().suppliers).toEqual([]);expect(application.retainSupplier(products[0]!.identity,products[0]!.offers[0]!.identity).ok).toBe(false);application.retainCandidate(products[0]!.identity);const retained=application.retainSupplier(products[0]!.identity,products[0]!.offers[0]!.identity);expect(retained).toMatchObject({ok:true,value:{standing:'allowed',merchantLinks:[{source:provider,externalId:'merchant-a'}]}});const revision=application.getSnapshot().revision;expect(application.setSupplierStanding(retained.ok?retained.value.id:'','allowed')).toMatchObject({ok:true});expect(application.getSnapshot().revision).toBe(revision)})

  it('uses exact supplier exclusion and critical risk in product and plan readiness without revising the plan',async()=>{const{application,products}=fixture(),candidate=products[0]!;candidate.offers[0]!.oneTimeCostCoverage={status:'complete',evidence:{strength:'source_explicit',source:'fixture'}};await application.searchCandidates({query:'products'});application.retainCandidate(candidate.identity);const retained=application.retainSupplier(candidate.identity,candidate.offers[0]!.identity);expect(retained.ok).toBe(true);if(!retained.ok)return;application.setSupplierStanding(retained.value.id,'excluded');expect(application.evaluateCandidate(candidate.identity)).toMatchObject({ok:true,value:{supplier:{standing:'excluded'},readiness:'blocked_by_known_failure'}});application.addCandidateToPlan(candidate.identity);const before=application.getSnapshot().plan.revision,evaluation=application.evaluatePurchasePlan();expect(application.getSnapshot().plan.revision).toBe(before);expect(evaluation).toMatchObject({ok:true,value:{readiness:'blocked_by_known_failure',supplierAssessments:[{supplierId:retained.value.id}]}})})
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
  it('owns quotation canonical fields and rejects wrong subject kind or supplier binding before mutation',async()=>{const{application,products}=fixture();await application.searchCandidates({query:'products'});products.forEach(item=>application.retainCandidate(item.identity));const retained=application.retainSupplier(products[0]!.identity,products[0]!.offers[0]!.identity);expect(retained.ok).toBe(true);if(!retained.ok)return;const input=(subject:unknown)=>({subject,components:[],coverage:{status:'partial' as const,evidence:{strength:'source_explicit' as const,source:'human'},reasons:['Costs incomplete']},evidence:{strength:'source_explicit' as const,source:'human'}}),before=application.getSnapshot();for(const subject of [{kind:'offer',source:provider,externalId:products[1]!.offers[0]!.identity.id},{kind:'offer',source:provider,externalId:products[0]!.identity.id},{kind:'candidate',source:provider,externalId:products[0]!.offers[0]!.identity.id}])expect(application.recordSupplierQuotation(retained.value.id,input(subject) as never)).toMatchObject({ok:false,code:'invalid_input'});expect(application.getSnapshot()).toBe(before);expect(application.recordSupplierQuotation(retained.value.id,input({kind:'offer',source:provider,externalId:products[0]!.offers[0]!.identity.id}) as never)).toMatchObject({ok:true});const stored=application.getSnapshot().suppliers[0]!.quotations[0]!;expect(stored).toMatchObject({supplierId:retained.value.id,requirementId:application.getSnapshot().activeGoal!.id,requirementRevision:application.getSnapshot().activeGoal!.revision,status:'active'})})

  it('bounds every malformed quotation input without mutation or notification',async()=>{
    const{application,products}=fixture();await application.searchCandidates({query:'products'});application.retainCandidate(products[0]!.identity)
    const retained=application.retainSupplier(products[0]!.identity,products[0]!.offers[0]!.identity);expect(retained.ok).toBe(true);if(!retained.ok)return
    const before=application.getSnapshot(),listener=vi.fn(),unsubscribe=application.subscribe(listener),invalid=[null,{}, {subject:null},{subject:{}},{subject:{kind:'invented'}},{subject:{kind:'offer'}},{subject:{kind:'offer',source:provider,externalId:'a-offer'},id:'caller-id'},{subject:{kind:'offer',source:provider,externalId:'a-offer'},supplierId:retained.value.id},{subject:{kind:'offer',source:provider,externalId:'a-offer'},requirementId:'goal'},{subject:{kind:'offer',source:provider,externalId:'a-offer'},requirementRevision:1},{subject:{kind:'offer',source:provider,externalId:'a-offer'},observedAt:'2020-01-01T00:00:00.000Z'},{subject:{kind:'offer',source:provider,externalId:'a-offer'},status:'active'}]
    for(const input of invalid){expect(()=>application.recordSupplierQuotation(retained.value.id,input as never)).not.toThrow();expect(application.recordSupplierQuotation(retained.value.id,input as never)).toMatchObject({ok:false,code:'invalid_input'})}
    unsubscribe();expect(application.getSnapshot()).toBe(before);expect(listener).not.toHaveBeenCalled()
  })
  it('validates standing and preserves rename identity, no-op revision, and coherent merchant-link activity',async()=>{const{application,products}=fixture();await application.searchCandidates({query:'products'});products.forEach(item=>application.retainCandidate(item.identity));const retained=application.retainSupplier(products[0]!.identity,products[0]!.offers[0]!.identity);expect(retained.ok).toBe(true);if(!retained.ok)return;const before=application.getSnapshot();expect(application.setSupplierStanding(retained.value.id,'invalid')).toMatchObject({ok:false});expect(application.getSnapshot()).toBe(before);const renamed=application.renameSupplier(retained.value.id,'Renamed');expect(renamed).toMatchObject({ok:true,value:{id:retained.value.id,name:'Renamed'}});const revision=renamed.ok?renamed.value.revision:0,stateRevision=application.getSnapshot().revision;application.renameSupplier(retained.value.id,'Renamed');expect(application.getSnapshot().suppliers[0]!.revision).toBe(revision);expect(application.getSnapshot().revision).toBe(stateRevision);const activities=application.getSnapshot().activities.length;expect(application.linkSupplierMerchant(retained.value.id,products[1]!.identity,products[1]!.offers[0]!.identity)).toMatchObject({ok:true});expect(application.getSnapshot().activities).toHaveLength(activities+1)})
  it('conservatively composes verification-only supplier evidence without revising the plan',async()=>{const{application,products}=fixture(),candidate=products[0]!;candidate.offers[0]!.oneTimeCostCoverage={status:'complete',evidence:{strength:'source_explicit',source:'fixture'}};await application.searchCandidates({query:'products'});application.retainCandidate(candidate.identity);const retained=application.retainSupplier(candidate.identity,candidate.offers[0]!.identity);if(!retained.ok)return;application.recordSupplierQuotation(retained.value.id,{subject:{kind:'offer',source:provider,externalId:candidate.offers[0]!.identity.id},components:[],coverage:{status:'partial',evidence:{strength:'source_inferred',source:'human'},reasons:['Incomplete']},evidence:{strength:'source_inferred',source:'human'}});application.recordSupplierReliability(retained.value.id,{category:'delivery_outcome',outcome:'positive',summary:'Reported',evidence:{strength:'source_inferred',source:'human'}});const candidateEvaluation=application.evaluateCandidate(candidate.identity);expect(candidateEvaluation).toMatchObject({ok:true,value:{readiness:'insufficient_evidence',supplier:{quotationState:'current_partial',reliability:'verification_required'}}});application.addCandidateToPlan(candidate.identity);const revision=application.getSnapshot().plan.revision;expect(application.evaluatePurchasePlan()).toMatchObject({ok:true,value:{readiness:'insufficient_evidence'}});expect(application.getSnapshot().plan.revision).toBe(revision)})
  it('propagates mixed-strength reliability verification through candidate, comparison, and plan readiness',async()=>{
    const{application,products}=fixture(),candidate=products[0]!,other=products[1]!,evidence={strength:'source_explicit' as const,source:'fixture'}
    application.editGoal({maximumItemPrice:{minorAmount:2000,currency:'USD'}});application.commitGoalDraft()
    for(const item of products)item.offers[0]!.oneTimeCostCoverage={status:'complete',evidence}
    await application.searchCandidates({query:'products'});products.forEach(item=>application.retainCandidate(item.identity))
    const retained=application.retainSupplier(candidate.identity,candidate.offers[0]!.identity);expect(retained.ok).toBe(true);if(!retained.ok)return
    expect(application.recordSupplierQuotation(retained.value.id,{subject:{kind:'offer',source:provider,externalId:candidate.offers[0]!.identity.id},components:[],coverage:{status:'complete',evidence},evidence})).toMatchObject({ok:true})
    expect(application.recordSupplierReliability(retained.value.id,{category:'delivery_outcome',outcome:'positive',summary:'Known positive',evidence})).toMatchObject({ok:true})
    expect(application.recordSupplierReliability(retained.value.id,{category:'delivery_outcome',outcome:'negative',summary:'Reported negative',evidence:{strength:'source_inferred',source:'fixture'}})).toMatchObject({ok:true})
    expect(application.evaluateCandidate(candidate.identity)).toMatchObject({ok:true,value:{readiness:'verification_required',supplier:{reliability:'verification_required',readiness:'verification_required'}}})
    expect(application.compareCandidates(candidate.identity,other.identity)).toMatchObject({ok:true,value:{outcome:'insufficient_evidence'}})
    application.addCandidateToPlan(candidate.identity)
    expect(application.evaluatePurchasePlan()).toMatchObject({ok:true,value:{readiness:'verification_required',supplierAssessments:[{supplierId:retained.value.id,reliability:'verification_required'}]}})
  })
  it('reads and resolves canonical supplier risk time without an active goal or read-side mutation',async()=>{
    let id=0
    const candidate=product('exploratory'),application=createCoSourceApplication({market,catalog:{search:async()=>({products:[candidate],messages:[],pagination:{hasMore:false}}),product:async()=>({product:candidate,selectedOptions:[],messages:[]})},makeId:()=>`risk-${++id}`,now:()=> '2026-09-02T12:00:00.000Z'})
    await application.searchCandidates({query:'exploratory'});application.retainCandidate(candidate.identity)
    const retained=application.retainSupplier(candidate.identity,candidate.offers[0]!.identity);expect(retained.ok).toBe(true);if(!retained.ok)return
    expect(application.recordSupplierRisk(retained.value.id,{category:'fulfilment',severity:'high',reason:'Current risk',evidence:{strength:'source_explicit',source:'human_record'}})).toMatchObject({ok:true})
    expect(application.assessSupplier(retained.value.id)).toMatchObject({ok:false,code:'invalid_state'})
    const before=application.getSnapshot(),risk=before.suppliers[0]!.risks[0]!,listener=vi.fn(),unsubscribe=application.subscribe(listener)
    expect(application.getSupplierRiskStatus(retained.value.id,risk.id)).toEqual({ok:true,value:{status:'active',resolutionAllowed:true}})
    expect(application.getSupplierRiskStatus('unknown-supplier',risk.id)).toMatchObject({ok:false,code:'invalid_input'})
    expect(application.getSupplierRiskStatus(retained.value.id,'unknown-risk')).toMatchObject({ok:false,code:'invalid_input'})
    unsubscribe();expect(application.getSnapshot()).toBe(before);expect(listener).not.toHaveBeenCalled()
    const plan=before.plan
    expect(application.resolveSupplierRisk(retained.value.id,risk.id)).toMatchObject({ok:true,value:{risks:[{id:risk.id,status:'resolved'}]}})
    expect(application.getSnapshot().plan).toBe(plan)
  })
})
