import { useState } from 'react'
import type { ProductCluster, ProviderIdentity } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import { createPurchasePlan, type PurchasePlan } from './domain/purchase-plan'
import { addProductToPlan, rebasePlanToGoal, removePlanLine, selectPlanLineOffer, setPlanLineQuantity } from './mutate-plan'

const id = () => globalThis.crypto?.randomUUID?.() ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`
export function usePurchasePlan(goal: PurchaseGoal | undefined, evidenceProducts: ProductCluster[], retainEvidence: (product: ProductCluster) => void) {
  const [plan, setPlan] = useState<PurchasePlan>(() => createPurchasePlan(id(), goal?.id ?? 'unvalidated-goal', goal?.revision ?? 0))
  const addProduct = (product: ProductCluster) => { retainEvidence(product); setPlan((current) => addProductToPlan(current.lines.length===0&&goal?{...current,goalId:goal.id,goalRevision:goal.revision}:current, product, id())) }
  const removeLine = (lineId: string) => setPlan((current) => removePlanLine(current, lineId))
  const setQuantity = (lineId: string, quantity: number) => setPlan((current) => setPlanLineQuantity(current, lineId, quantity))
  const selectOffer = (lineId: string, offer: ProviderIdentity | undefined) => setPlan((current) => selectPlanLineOffer(current, lineId, offer, evidenceProducts))
  const rebaseToGoal = () => goal && setPlan((current) => rebasePlanToGoal(current, goal.id, goal.revision))
  const replacePlan = (next:PurchasePlan) => setPlan(next)
  return { plan, addProduct, removeLine, setQuantity, selectOffer, rebaseToGoal, replacePlan }
}
export type PurchasePlanController=ReturnType<typeof usePurchasePlan>
