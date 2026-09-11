import type { MerchantOffer, ProductCluster } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import { evaluateProductAgainstGoal } from '../evaluation/evaluate-product'
import { providerIdentityKey, sameProviderIdentity } from '../commerce/domain/provider-identity'
import type { PlanBudgetEvaluation, PlanEvaluation, PurchasePlan } from './domain/purchase-plan'
import type { ProductEvidenceEntry } from '../evidence/product-evidence-ledger'
import { assessEvidenceFreshness } from '../evidence/domain/evidence'
import type { EvidenceFreshnessPolicy } from '../evidence/domain/evidence'
import {assessCosts} from '../costing/assess-cost'
import {offerCostLine} from '../costing/commerce-cost-adapter'
import type {CostLineInput} from '../costing/domain/cost'
import type {SupplierAssessment} from '../suppliers/domain/supplier-intelligence'
import {composeDecisionReadiness} from '../evidence/domain/evidence'

export function neutralOffer(product: ProductCluster): MerchantOffer | undefined {
  if (product.featuredOfferId) {
    const found = product.offers.find((offer) => offer.identity.provider === product.identity.provider && offer.identity.id === product.featuredOfferId)
    if (found) return found
  }
  return product.offers.length === 1 ? product.offers[0] : undefined
}

export function evaluatePurchasePlan(goal: PurchaseGoal, plan: PurchasePlan, products: ProductCluster[], evidenceEntries:ProductEvidenceEntry[]=[], now=new Date().toISOString(), freshnessPolicy?:EvidenceFreshnessPolicy,supplierForOffer?:(offer:MerchantOffer)=>SupplierAssessment|undefined): PlanEvaluation {
  if (plan.lines.length === 0) return {
    status: 'draft', stale: false, mandatoryFailures: 0, exclusionViolations: 0, mandatoryUnknowns: 0,
    preferencesSatisfied: 0, preferencesUnknown: 0, merchantCount: 0, currencies: [], knownSubtotals: [], unresolvedCosts: [],
  }
  const byId = new Map(products.map((product) => [providerIdentityKey(product.identity), product]))
  let mandatoryFailures = 0, exclusionViolations = 0, mandatoryUnknowns = 0
  let preferencesSatisfied = 0, preferencesUnknown = 0, costEvidenceIncomplete = false
  const merchants = new Set<string>(), currencies = new Set<string>()
  const unresolvedCosts: string[] = [],costLines:CostLineInput[]=[]
  const lineReadiness:Array<{readiness:NonNullable<PlanEvaluation['readiness']>;reasons:string[]}>=[]
  const supplierAssessments:SupplierAssessment[]=[]
  const unresolved = (reason: string) => { costEvidenceIncomplete = true; unresolvedCosts.push(reason) }
  const incompleteLine=(lineId:string,reason:string):CostLineInput=>({id:lineId,quantity:1,unitSemantics:'unknown',components:[],coverage:{status:'partial',evidence:{strength:'unknown',source:'plan_evaluation'},reasons:[reason]}})
  for (const line of plan.lines) {
    const product = byId.get(providerIdentityKey(line.product))
    if (!product) {
      mandatoryUnknowns++
      unresolved(`${line.productTitle}: product evidence is unavailable.`)
      costLines.push(incompleteLine(line.id,`${line.productTitle}: product evidence is unavailable.`))
      lineReadiness.push({readiness:'insufficient_evidence',reasons:[`${line.productTitle}: retained product evidence is unavailable.`]})
      continue
    }
    const offer = line.selectedOffer
      ? product.offers.find((candidate) => line.selectedOffer && sameProviderIdentity(candidate.identity, line.selectedOffer))
      : neutralOffer(product)
    const entry=evidenceEntries.find(item=>sameProviderIdentity(item.subject,line.product))
    const evaluation = evaluateProductAgainstGoal(goal, product, offer,{observedAt:entry?.current.observedAt,freshness:entry?assessEvidenceFreshness(entry.current.observedAt,freshnessPolicy,now):freshnessPolicy?'unknown':'not_constrained'})
    lineReadiness.push({readiness:evaluation.readiness??'insufficient_evidence',reasons:evaluation.readinessReasons??[]})
    mandatoryFailures += evaluation.requirements.filter((result) => result.status === 'failed').length
    if (evaluation.budget?.status === 'failed') mandatoryFailures++
    exclusionViolations += evaluation.exclusions.filter((result) => result.status === 'failed').length
    mandatoryUnknowns += evaluation.requirements.filter((result) => result.status === 'unknown').length
    preferencesSatisfied += evaluation.preferences.filter((result) => result.status === 'satisfied').length
    preferencesUnknown += evaluation.preferences.filter((result) => result.status === 'unknown').length
    if (!offer) {
      unresolved(`${line.productTitle}: no merchant offer is selected.`)
      costLines.push(incompleteLine(line.id,`${line.productTitle}: no merchant offer is selected.`))
      continue
    }
    const supplier=supplierForOffer?.(offer)
    if(supplier){supplierAssessments.push(supplier);lineReadiness.push({readiness:supplier.readiness,reasons:supplier.reasons})}
    currencies.add(offer.price.currency)
    if (offer.merchant?.identity?.id) merchants.add(providerIdentityKey(offer.merchant.identity))
    else if (offer.merchant?.domain) merchants.add(offer.merchant.domain)
    if ((line.quantity ?? 1) > 1 && line.unitSemantics !== 'single_item') {
      unresolved(`${line.productTitle}: quantity semantics are unclear; price multiplication was not performed.`)
    }
    try{costLines.push(offerCostLine({id:line.id,quantity:line.quantity??1,unitSemantics:line.unitSemantics},offer))}catch{const reason=`${line.productTitle}: selected offer cost evidence is invalid and requires verification.`;unresolved(reason);costLines.push(incompleteLine(line.id,reason))}
  }
  let costAssessment;try{costAssessment=assessCosts(costLines,goal.budget)}catch(error){const reason=error instanceof Error?error.message:'Cost assessment failed';unresolved(reason);costAssessment=assessCosts(plan.lines.map(line=>incompleteLine(line.id,reason)),goal.budget)}
  unresolvedCosts.push(...costAssessment.verificationReasons)
  costEvidenceIncomplete ||= costAssessment.completeness!=='complete_exact'
  const budget:PlanBudgetEvaluation|undefined=costAssessment.budget&&goal.budget?{status:costAssessment.budget.status,evidence:{kind:costAssessment.budget.status==='unknown'?'unknown':'cosource_derived'},goalBudget:goal.budget,comparableSubtotal:costAssessment.currencyTotals.find(item=>item.currency===goal.budget?.currency)?.knownLowerBound,reason:costAssessment.budget.reason}:undefined
  const stale = plan.goalId !== goal.id || plan.goalRevision !== goal.revision
  const supplierFailure=supplierAssessments.some(item=>item.readiness==='blocked_by_known_failure'),supplierConflict=supplierAssessments.some(item=>item.readiness==='blocked_by_known_conflict')
  const hasKnownConflict = Boolean(mandatoryFailures || exclusionViolations || budget?.status === 'failed'||supplierFailure||supplierConflict)
  const status = hasKnownConflict ? 'has_known_conflicts'
      : stale || costEvidenceIncomplete || budget?.status === 'unknown' ? 'incomplete'
        : mandatoryUnknowns ? 'has_unverified_requirements' : 'ready_on_known_evidence'
  const readiness=composeDecisionReadiness(mandatoryFailures||exclusionViolations||budget?.status==='failed'?'blocked_by_known_failure':undefined,stale||costEvidenceIncomplete||budget?.status==='unknown'?'insufficient_evidence':undefined,...lineReadiness.map(item=>item.readiness))
  const readinessReasons=[...new Set([...lineReadiness.flatMap(item=>item.reasons),...(stale?['The plan is bound to an earlier goal revision.']:[]),...(costEvidenceIncomplete?['One or more plan costs or offer selections are unresolved.']:[]),...(budget?.status==='failed'?[budget.reason]:[]),...(budget?.status==='unknown'?[budget.reason]:[])])].slice(0,10)
  const evidenceAwareStatus=evidenceEntries.length&&readiness!=='ready_on_current_evidence'&&status==='ready_on_known_evidence'?'has_unverified_requirements':status
  return { status:evidenceAwareStatus, stale, mandatoryFailures, exclusionViolations, mandatoryUnknowns, preferencesSatisfied,
    preferencesUnknown, merchantCount: merchants.size, currencies: [...currencies],
    knownSubtotals: costAssessment.currencyTotals.map(item=>item.baseSubtotal), unresolvedCosts:[...new Set(unresolvedCosts)], budget,costAssessment,readiness,readinessReasons,supplierAssessments }
}
