import type { MerchantOffer, ProductCluster } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import { evaluateProductAgainstGoal } from '../evaluation/evaluate-product'
import { providerIdentityKey, sameProviderIdentity } from '../commerce/domain/provider-identity'
import type { PlanBudgetEvaluation, PlanEvaluation, PurchasePlan } from './domain/purchase-plan'
import type { ProductEvidenceEntry } from '../evidence/product-evidence-ledger'
import { assessEvidenceFreshness } from '../evidence/domain/evidence'
import type { EvidenceFreshnessPolicy } from '../evidence/domain/evidence'

export function neutralOffer(product: ProductCluster): MerchantOffer | undefined {
  if (product.featuredOfferId) {
    const found = product.offers.find((offer) => offer.identity.provider === product.identity.provider && offer.identity.id === product.featuredOfferId)
    if (found) return found
  }
  return product.offers.length === 1 ? product.offers[0] : undefined
}

function evaluatePlanBudget(goal: PurchaseGoal, subtotals: Map<string, number>, costEvidenceIncomplete: boolean): PlanBudgetEvaluation | undefined {
  if (!goal.budget) return undefined
  const comparable = subtotals.get(goal.budget.currency)
  const hasOtherCurrency = [...subtotals.keys()].some((currency) => currency !== goal.budget?.currency)
  if (costEvidenceIncomplete || hasOtherCurrency) return {
    status: 'unknown', evidence: { kind: 'unknown' }, goalBudget: goal.budget,
    comparableSubtotal: comparable === undefined ? undefined : { currency: goal.budget.currency, minorAmount: comparable },
    reason: 'The plan budget cannot be verified because some item costs, quantities, or currencies are unresolved.',
  }
  const subtotal = { currency: goal.budget.currency, minorAmount: comparable ?? 0 }
  const status = subtotal.minorAmount <= goal.budget.minorAmount ? 'satisfied' : 'failed'
  return {
    status, evidence: { kind: 'cosource_derived' }, goalBudget: goal.budget, comparableSubtotal: subtotal,
    reason: status === 'satisfied'
      ? `Known item-price subtotal is within the ${goal.budget.currency} budget.`
      : `Known item-price subtotal exceeds the ${goal.budget.currency} budget.`,
  }
}

export function evaluatePurchasePlan(goal: PurchaseGoal, plan: PurchasePlan, products: ProductCluster[], evidenceEntries:ProductEvidenceEntry[]=[], now=new Date().toISOString(), freshnessPolicy?:EvidenceFreshnessPolicy): PlanEvaluation {
  if (plan.lines.length === 0) return {
    status: 'draft', stale: false, mandatoryFailures: 0, exclusionViolations: 0, mandatoryUnknowns: 0,
    preferencesSatisfied: 0, preferencesUnknown: 0, merchantCount: 0, currencies: [], knownSubtotals: [], unresolvedCosts: [],
  }
  const byId = new Map(products.map((product) => [providerIdentityKey(product.identity), product]))
  let mandatoryFailures = 0, exclusionViolations = 0, mandatoryUnknowns = 0
  let preferencesSatisfied = 0, preferencesUnknown = 0, costEvidenceIncomplete = false
  const merchants = new Set<string>(), currencies = new Set<string>()
  const subtotals = new Map<string, number>(), unresolvedCosts: string[] = []
  const lineReadiness:Array<{readiness:NonNullable<PlanEvaluation['readiness']>;reasons:string[]}>=[]
  const unresolved = (reason: string) => { costEvidenceIncomplete = true; unresolvedCosts.push(reason) }
  for (const line of plan.lines) {
    const product = byId.get(providerIdentityKey(line.product))
    if (!product) {
      mandatoryUnknowns++
      unresolved(`${line.productTitle}: product evidence is unavailable.`)
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
      continue
    }
    currencies.add(offer.price.currency)
    if (offer.merchant?.identity?.id) merchants.add(providerIdentityKey(offer.merchant.identity))
    else if (offer.merchant?.domain) merchants.add(offer.merchant.domain)
    if ((line.quantity ?? 1) > 1 && line.unitSemantics !== 'single_item') {
      unresolved(`${line.productTitle}: quantity semantics are unclear; price multiplication was not performed.`)
      continue
    }
    const quantity = line.quantity ?? 1
    const lineSubtotal = offer.price.minorAmount * quantity
    if (!Number.isSafeInteger(lineSubtotal)) {
      unresolved(`${line.productTitle}: line subtotal would exceed the safe integer range.`)
      continue
    }
    const prospectiveAggregate = (subtotals.get(offer.price.currency) ?? 0) + lineSubtotal
    if (!Number.isSafeInteger(prospectiveAggregate)) {
      unresolved(`${offer.price.currency} known subtotal: cumulative amount would exceed the safe integer range.`)
      continue
    }
    subtotals.set(offer.price.currency, prospectiveAggregate)
  }
  const budget = evaluatePlanBudget(goal, subtotals, costEvidenceIncomplete)
  const stale = plan.goalId !== goal.id || plan.goalRevision !== goal.revision
  const hasKnownConflict = Boolean(mandatoryFailures || exclusionViolations || budget?.status === 'failed')
  const status = hasKnownConflict ? 'has_known_conflicts'
      : stale || costEvidenceIncomplete || budget?.status === 'unknown' ? 'incomplete'
        : mandatoryUnknowns ? 'has_unverified_requirements' : 'ready_on_known_evidence'
  const readiness:NonNullable<PlanEvaluation['readiness']>=lineReadiness.some(item=>item.readiness==='blocked_by_known_conflict')?'blocked_by_known_conflict'
    :mandatoryFailures||exclusionViolations||budget?.status==='failed'?'blocked_by_known_failure'
      :stale||costEvidenceIncomplete||budget?.status==='unknown'||lineReadiness.some(item=>item.readiness==='insufficient_evidence')?'insufficient_evidence'
        :lineReadiness.some(item=>item.readiness==='verification_required')?'verification_required':'ready_on_current_evidence'
  const readinessReasons=[...new Set([...lineReadiness.flatMap(item=>item.reasons),...(stale?['The plan is bound to an earlier goal revision.']:[]),...(costEvidenceIncomplete?['One or more plan costs or offer selections are unresolved.']:[]),...(budget?.status==='failed'?[budget.reason]:[]),...(budget?.status==='unknown'?[budget.reason]:[])])].slice(0,10)
  const evidenceAwareStatus=evidenceEntries.length&&readiness!=='ready_on_current_evidence'&&status==='ready_on_known_evidence'?'has_unverified_requirements':status
  return { status:evidenceAwareStatus, stale, mandatoryFailures, exclusionViolations, mandatoryUnknowns, preferencesSatisfied,
    preferencesUnknown, merchantCount: merchants.size, currencies: [...currencies],
    knownSubtotals: [...subtotals].map(([currency, minorAmount]) => ({ currency, minorAmount })), unresolvedCosts, budget,readiness,readinessReasons }
}
