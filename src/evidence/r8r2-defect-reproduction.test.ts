import {describe,expect,it} from 'vitest'
import {createCoSourceApplication} from '../application/cosource-application'
import {durableProjection,PERSISTED_WORKSPACE_FORMAT_VERSION} from '../application/persistence/workspace-persistence'
import {parsePersistedWorkspace} from '../application/persistence/persisted-workspace-schema'
import type {ProductCluster,ProvenanceKind} from '../commerce/domain/commerce'
import {createApplicationTools} from '../webmcp/application-tools'
import {evaluateProductAgainstGoal} from '../evaluation/evaluate-product'

const provider='shopify_global_catalog' as const,now='2026-09-11T12:00:00.000Z'
const product=(values:string[],kind:ProvenanceKind='provider_explicit'):ProductCluster=>({identity:{provider,id:'candidate'},title:{value:'Candidate',provenance:{kind:'provider_explicit',provider}},attributes:{value:values.map(value=>({name:'Size',value})),provenance:{kind,provider}},media:[],offers:[{identity:{provider,id:'offer'},title:{value:'Offer',provenance:{kind:'provider_explicit',provider}},price:{minorAmount:1000,currency:'GBP'},oneTimeCostCoverage:{status:'complete',evidence:{strength:'source_explicit',source:'fixture'}},availability:{state:'available',basis:'catalog_signal',provenance:{kind:'provider_explicit',provider}},selectedOptions:[],media:[],correlations:[],provenance:{kind:'provider_explicit',provider}}],featuredOfferId:'offer',offerCompleteness:'featured_only',provenance:{kind:'provider_explicit',provider}})
async function setup(values:string[],kind:ProvenanceKind='provider_explicit'){
 let sequence=0,current=product(values,kind)
 const application=createCoSourceApplication({market:{country:'GB',currency:'GBP'},makeId:()=>`id-${++sequence}`,now:()=>now,catalog:{search:async()=>({products:[current],messages:[],pagination:{hasMore:false}}),product:async()=>({product:current,selectedOptions:[],messages:[]})}})
 application.editGoal({summary:'Large product',searchFocus:'product'});application.addGoalCondition('requirement')
 const condition=application.getSnapshot().goalDraft.requirements[0]!
 application.editGoalCondition('requirement',condition.id,{operator:'equals',field:'Size',value:'large'});application.commitGoalDraft();await application.searchCandidates({query:'product'});application.retainCandidate(current.identity)
 return{application,condition,setCurrent:(next:ProductCluster)=>{current=next}}
}
const envelope=(application:ReturnType<typeof createCoSourceApplication>)=>{const payload=durableProjection(application.getSnapshot());return{formatVersion:PERSISTED_WORKSPACE_FORMAT_VERSION,workspaceId:payload.id,durableRevision:0,savedAt:now,market:payload.market,payload}}

describe('R8R2 exact durable claim reconciliation',()=>{
 it('recomputes failure from a remaining contradictory claim and missing after all claims are rejected',async()=>{const{application}=await setup(['large','small']),goal=application.getSnapshot().activeGoal!,item=application.getSnapshot().retainedProducts[0]!,raw=evaluateProductAgainstGoal(goal,item),claims=raw.requirements[0]!.claims!,large=claims.find(claim=>claim.value==='large')!,small=claims.find(claim=>claim.value==='small')!,decision=(claimReference:string)=>({conditionId:goal.requirements[0]!.id,outcome:'rejected' as const,claimReference,verificationId:`reject-${claimReference}`});expect(evaluateProductAgainstGoal(goal,item,undefined,{freshness:'not_constrained'},[decision(large.id)])).toMatchObject({requirements:[{status:'failed'}],readiness:'blocked_by_known_failure'});expect(evaluateProductAgainstGoal(goal,item,undefined,{freshness:'not_constrained'},[decision(large.id),decision(small.id)])).toMatchObject({requirements:[{status:'unknown'}],readiness:'insufficient_evidence'})})
 it('reconciles a rejected conflict across evaluation, issues, plan and WebMCP',async()=>{
  const{application}=await setup(['large','small']),raw=structuredClone(application.getSnapshot().retainedEvidence),issueResult=application.getEvidenceIssues({provider,id:'candidate'});if(!issueResult.ok)return
  const issue=issueResult.value.find(item=>item.kind==='conflicting')!,small=issue.claimReferences.find(reference=>decodeURIComponent(reference).endsWith(':small'))!
  application.addCandidateToPlan({provider,id:'candidate'});const revision=application.getSnapshot().plan.revision
  expect(application.recordHumanVerification({issueId:issue.id,outcome:'rejected',claimReference:small,note:'Rejected exact small claim'}).ok).toBe(true)
  expect(application.evaluateCandidate({provider,id:'candidate'})).toMatchObject({ok:true,value:{requirements:[{status:'satisfied'}],readiness:'ready_on_current_evidence'}})
  expect(application.getSnapshot().plan.revision).toBe(revision);expect(application.getSnapshot().retainedEvidence).toEqual(raw)
  const reconciled=application.getEvidenceIssues({provider,id:'candidate'});expect(reconciled).toMatchObject({ok:true,value:expect.arrayContaining([expect.objectContaining({id:issue.id,resolved:true,blocksReadiness:false,routes:[]})])})
  if(reconciled.ok)expect(reconciled.value.some(item=>item.blocksReadiness&&!item.resolved)).toBe(false)
  const output=await createApplicationTools(application).find(item=>item.name==='get_evidence_gaps')!.execute({product:{provider,id:'candidate'}}) as {data:{readiness:string;issues:Array<{resolved:boolean;blocksReadiness:boolean}>}}
  expect(output.data.readiness).toBe('ready_on_current_evidence');expect(output.data.issues.some(item=>item.blocksReadiness&&!item.resolved)).toBe(false)
 })
 it('binds confirmation to the accepted observation and rejects forged durable claims',async()=>{
  const{application,setCurrent}=await setup(['large'],'provider_inferred'),issues=application.getEvidenceIssues({provider,id:'candidate'});if(!issues.ok)return
  const issue=issues.value.find(item=>item.kind==='verification_required')!,confirmation=application.recordHumanVerification({issueId:issue.id,outcome:'confirmed',claimReference:issue.claimReferences[0],note:'Confirmed exact label'});expect(confirmation.ok).toBe(true);if(!confirmation.ok)return
  expect(confirmation.value.claimBinding).toMatchObject({observationId:application.getSnapshot().retainedEvidence[0]!.current.id,field:'Size',value:'large',provenance:'provider_inferred'})
  const valid=envelope(application);expect(parsePersistedWorkspace(valid).ok).toBe(true)
  const forge=(changes:Record<string,unknown>)=>structuredClone({...valid,payload:{...valid.payload,humanVerifications:[{...confirmation.value,...changes}]}})
  expect(parsePersistedWorkspace(forge({claimReference:'claim:size:provider_inferred:forged'}))).toEqual({ok:false,reason:'corrupt'})
  expect(parsePersistedWorkspace(forge({claimBinding:{...confirmation.value.claimBinding,observationId:'other'}}))).toEqual({ok:false,reason:'corrupt'})
  expect(parsePersistedWorkspace(forge({claimBinding:{...confirmation.value.claimBinding,value:'small'}}))).toEqual({ok:false,reason:'corrupt'})
  setCurrent(product(['large'],'provider_inferred'));await application.refreshRetainedEvidence({provider,id:'candidate'});expect(application.evaluateCandidate({provider,id:'candidate'})).toMatchObject({ok:true,value:{readiness:'verification_required'}})
 })
 it('retains earlier-revision verification after condition replacement without applying it',async()=>{
  const{application,condition}=await setup(['large'],'provider_inferred'),issues=application.getEvidenceIssues({provider,id:'candidate'});if(!issues.ok)return
  const issue=issues.value.find(item=>item.kind==='verification_required')!;expect(application.recordHumanVerification({issueId:issue.id,outcome:'confirmed',claimReference:issue.claimReferences[0],note:'Confirmed historical claim'}).ok).toBe(true)
  application.removeGoalCondition('requirement',condition.id);application.addGoalCondition('requirement');const replacement=application.getSnapshot().goalDraft.requirements[0]!;application.editGoalCondition('requirement',replacement.id,{operator:'equals',field:'Size',value:'small'});application.commitGoalDraft()
  expect(parsePersistedWorkspace(envelope(application)).ok).toBe(true);expect(application.evaluateCandidate({provider,id:'candidate'})).toMatchObject({ok:true,value:{requirements:[{status:'unknown'}],readiness:'verification_required'}})
 })
})
