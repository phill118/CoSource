import {describe,expect,it} from 'vitest'
import type {MerchantOffer,ProductCluster} from '../commerce/domain/commerce'
import {createPurchaseGoal} from '../goals/domain/purchase-goal'
import {evaluatePurchasePlan} from '../planning/evaluate-plan'
import type {PurchasePlan} from '../planning/domain/purchase-plan'
import {observeProductEvidence} from '../evidence/product-evidence-ledger'
import {evaluateProductAgainstGoal} from './evaluate-product'

const provenance={kind:'provider_explicit' as const,provider:'shopify_global_catalog' as const}
const offer=(id:string,minorAmount:number):MerchantOffer=>({identity:{provider:'shopify_global_catalog',id},title:{value:id,provenance},price:{currency:'GBP',minorAmount},availability:{state:'available',basis:'catalog_signal',provenance},selectedOptions:[],media:[],correlations:[],provenance})
const product=(attributes?:Array<{name:string;value:string}>,offers:MerchantOffer[]=[]):ProductCluster=>({identity:{provider:'shopify_global_catalog',id:'p'},title:{value:'Product',provenance},attributes:attributes?{value:attributes,provenance}:undefined,media:[],offers,featuredOfferId:offers[0]?.identity.id,offerCompleteness:'provider_returned_unknown',provenance})
const goal=(condition:{operator:'free_text'|'is_true'|'at_least';field?:string;value?:string}|undefined,maximumItemPrice?:number)=>createPurchaseGoal({id:'g',summary:'Goal',maximumItemPrice:maximumItemPrice===undefined?undefined:{currency:'GBP',minorAmount:maximumItemPrice},requirements:condition?[{id:'c',...condition}]:[],preferences:[],exclusions:[]})

describe('R2R readiness and plan coherence regressions',()=>{
 it.each([
  ['mandatory free text',goal({operator:'free_text',value:'waterproof'}),product()],
  ['ambiguous boolean',goal({operator:'is_true',field:'Waterproof'}),product([{name:'Waterproof',value:'perhaps'}])],
  ['numeric unit mismatch',goal({operator:'at_least',field:'Capacity',value:'10'}),product([{name:'Capacity',value:'10 lb'}])],
  ['unknown maximum price',goal(undefined,1000),product()],
 ])('keeps mandatory unknown %s non-ready',(_label,inputGoal,inputProduct)=>{const result=evaluateProductAgainstGoal(inputGoal,inputProduct,undefined,{observedAt:'2026-01-01T00:00:00Z',freshness:'current'});expect({eligibility:result.eligibility,counts:result.counts,readiness:result.readiness,reason:result.readinessReasons?.[0]}).toMatchObject({eligibility:'eligible_with_unknowns',readiness:'insufficient_evidence'})})
 it('distinguishes a known failure from an evidence conflict',()=>{const result=evaluateProductAgainstGoal(goal({operator:'is_true',field:'Waterproof'}),product([{name:'Waterproof',value:'false'}]),undefined,{freshness:'current'});expect(result.requirements[0]?.status).toBe('failed');expect(result.requirements[0]?.issue).not.toBe('conflict');expect(result.readiness).toBe('blocked_by_known_failure')})
 it('keeps selected-offer failure and missing product evidence non-ready',()=>{const item=product(undefined,[offer('cheap',500),offer('expensive',1500)]),entry=[...observeProductEvidence(new Map(),item,'2026-01-01T00:00:00Z','o').values()][0]!;const selectedPlan:PurchasePlan={id:'plan',revision:1,goalId:'g',goalRevision:0,lines:[{id:'l',product:item.identity,productTitle:'Product',selectedOffer:offer('expensive',1500).identity,offerSelection:'explicit_human',quantity:1,unitSemantics:'single_item'}]};const selected=evaluatePurchasePlan(goal(undefined,1000),selectedPlan,[item],[entry],'2026-01-01T00:00:00Z');expect(selected).toMatchObject({status:'has_known_conflicts',readiness:'blocked_by_known_failure'});const supportedGoal=goal({operator:'is_true',field:'Waterproof'}),supported={...item,attributes:{value:[{name:'Waterproof',value:'true'}],provenance}},supportedEntry=[...observeProductEvidence(new Map(),supported,'2026-01-01T00:00:00Z','o').values()][0]!,missingPlan={...selectedPlan,lines:[selectedPlan.lines[0]!,{...selectedPlan.lines[0]!,id:'missing',product:{provider:'shopify_global_catalog' as const,id:'missing'},selectedOffer:undefined,offerSelection:undefined}]};const missing=evaluatePurchasePlan(supportedGoal,missingPlan,[supported],[supportedEntry],'2026-01-01T00:00:00Z');expect(missing).toMatchObject({status:'incomplete',readiness:'insufficient_evidence'})})
 it('keeps stale binding, unresolved offers, and whole-plan budget outcomes coherent',()=>{
  const item=product(undefined,[offer('only',600)]),entry=[...observeProductEvidence(new Map(),item,'2026-01-01T00:00:00Z','o').values()][0]!
  const budgetGoal=createPurchaseGoal({id:'g',summary:'Goal',budget:{currency:'GBP',minorAmount:500},requirements:[],preferences:[],exclusions:[]}),line={id:'l',product:item.identity,productTitle:'Product',selectedOffer:item.offers[0]!.identity,offerSelection:'explicit_human' as const,quantity:1,unitSemantics:'single_item' as const}
  expect(evaluatePurchasePlan(budgetGoal,{id:'p',revision:1,goalId:'g',goalRevision:0,lines:[line]},[item],[entry],'2026-01-01T00:00:00Z')).toMatchObject({status:'has_known_conflicts',readiness:'blocked_by_known_failure',budget:{status:'failed'}})
  const ambiguous={...item,featuredOfferId:undefined,offers:[offer('a',500),offer('b',600)]},ambiguousEntry=[...observeProductEvidence(new Map(),ambiguous,'2026-01-01T00:00:00Z','o2').values()][0]!
  expect(evaluatePurchasePlan(budgetGoal,{id:'p',revision:1,goalId:'g',goalRevision:0,lines:[{...line,selectedOffer:undefined,offerSelection:undefined}]},[ambiguous],[ambiguousEntry],'2026-01-01T00:00:00Z')).toMatchObject({status:'incomplete',readiness:'insufficient_evidence',budget:{status:'unknown'}})
  const revised={...budgetGoal,revision:1,budget:{currency:'GBP',minorAmount:700}}
  expect(evaluatePurchasePlan(revised,{id:'p',revision:1,goalId:'g',goalRevision:0,lines:[line]},[item],[entry],'2026-01-01T00:00:00Z')).toMatchObject({stale:true,readiness:'insufficient_evidence'})
 })
})
