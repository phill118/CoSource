import type { ProductCluster, ProviderIdentity } from '../commerce/domain/commerce'
import { findByProviderIdentity, sameProviderIdentity } from '../commerce/domain/provider-identity'
import { PLAN_QUANTITY_MAX, revisePurchasePlan, type PurchasePlan } from './domain/purchase-plan'

export function addProductToPlan(plan: PurchasePlan, product: ProductCluster, lineId: string): PurchasePlan {
  if (!lineId || plan.lines.some((line) => line.id === lineId)) throw new TypeError('Plan line identity must be unique and non-empty')
  if (plan.lines.some((line) => sameProviderIdentity(line.product, product.identity))) return plan
  return revisePurchasePlan(plan, [...plan.lines, { id: lineId, product: product.identity, productTitle: product.title.value, quantity: 1, unitSemantics: 'unknown' }])
}

export function removePlanLine(plan: PurchasePlan, lineId: string): PurchasePlan {
  if (!plan.lines.some((line) => line.id === lineId)) return plan
  return revisePurchasePlan(plan, plan.lines.filter((line) => line.id !== lineId))
}

export function setPlanLineQuantity(plan: PurchasePlan, lineId: string, quantity: number): PurchasePlan {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > PLAN_QUANTITY_MAX) throw new RangeError(`Quantity must be an integer from 1 to ${PLAN_QUANTITY_MAX}`)
  const target = plan.lines.find((line) => line.id === lineId)
  if (!target || target.quantity === quantity) return plan
  return revisePurchasePlan(plan, plan.lines.map((line) => line.id === lineId ? { ...line, quantity } : line))
}

export function selectPlanLineOffer(plan: PurchasePlan, lineId: string, offerIdentity: ProviderIdentity | undefined, products: ProductCluster[]): PurchasePlan {
  const target = plan.lines.find((line) => line.id === lineId)
  if (!target) return plan
  if (!offerIdentity) {
    if (!target.selectedOffer) return plan
    return revisePurchasePlan(plan, plan.lines.map((line) => line.id === lineId ? { ...line, selectedOffer: undefined, offerSelection: undefined } : line))
  }
  const product = products.find((candidate) => sameProviderIdentity(candidate.identity, target.product))
  const offer = product && findByProviderIdentity(product.offers, offerIdentity)
  if (!offer || (target.selectedOffer && sameProviderIdentity(target.selectedOffer, offer.identity))) return plan
  return revisePurchasePlan(plan, plan.lines.map((line) => line.id === lineId ? { ...line, selectedOffer: offer.identity, offerSelection: 'explicit_human' as const } : line))
}

export function rebasePlanToGoal(plan: PurchasePlan, goalId: string, goalRevision: number): PurchasePlan {
  if (plan.goalId === goalId && plan.goalRevision === goalRevision) return plan
  return { ...plan, goalId, goalRevision, revision: plan.revision + 1 }
}
