import { describe, expect, it } from 'vitest'
import type { CommerceProviderId, ProductCluster } from '../commerce/domain/commerce'
import { COMMERCE_PROVIDERS } from '../commerce/domain/commerce'
import { createPurchasePlan } from './domain/purchase-plan'
import { addProductToPlan, rebasePlanToGoal, removePlanLine, selectPlanLineOffer, setPlanLineQuantity } from './mutate-plan'

const provenance = { kind: 'provider_explicit' as const, provider: COMMERCE_PROVIDERS.shopifyGlobalCatalog }
function product(providerValue: string, id = 'shared', offerId = 'offer'): ProductCluster {
  const provider = providerValue as CommerceProviderId
  return { identity: { provider, id }, title: { value: `${providerValue}-${id}`, provenance }, media: [], offerCompleteness: 'provider_returned_unknown', provenance,
    offers: [{ identity: { provider, id: offerId }, title: { value: offerId, provenance }, price: { minorAmount: 100, currency: 'GBP' },
      availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance }] }
}

describe('explicit purchase-plan mutations', () => {
  it('allows same textual product IDs from different providers and rejects only canonical duplicates', () => {
    const a = product('provider-a'), b = product('provider-b')
    let plan = addProductToPlan(createPurchasePlan('p', 'g', 0), a, 'line-a')
    plan = addProductToPlan(plan, b, 'line-b')
    expect(plan.lines).toHaveLength(2); expect(plan.revision).toBe(2)
    expect(addProductToPlan(plan, a, 'unused-line')).toBe(plan)
  })
  it('sets only a valid bounded integer quantity and increments exactly once', () => {
    const item = product('provider-a'); const plan = addProductToPlan(createPurchasePlan('p', 'g', 0), item, 'line')
    const revised = setPlanLineQuantity(plan, 'line', 2)
    expect(revised.revision).toBe(plan.revision + 1)
    expect(revised.lines[0]).toMatchObject({ id: 'line', product: item.identity, quantity: 2 })
    for (const invalid of [0, -1, 1.5, 100_001, Number.NaN]) expect(() => setPlanLineQuantity(plan, 'line', invalid)).toThrow(RangeError)
  })
  it('selects and clears only an offer belonging to the canonical line product', () => {
    const item = product('provider-a'), wrongProvider = product('provider-b'), wrongProduct = product('provider-a', 'other', 'other-offer')
    const plan = addProductToPlan(createPurchasePlan('p', 'g', 0), item, 'line')
    expect(selectPlanLineOffer(plan, 'line', wrongProvider.offers[0]!.identity, [item, wrongProvider])).toBe(plan)
    expect(selectPlanLineOffer(plan, 'line', wrongProduct.offers[0]!.identity, [item, wrongProduct])).toBe(plan)
    const selected = selectPlanLineOffer(plan, 'line', item.offers[0]!.identity, [item])
    expect(selected).toMatchObject({ revision: plan.revision + 1, lines: [{ id: 'line', product: item.identity, selectedOffer: item.offers[0]!.identity, offerSelection: 'explicit_human' }] })
    const cleared = selectPlanLineOffer(selected, 'line', undefined, [item])
    expect(cleared.revision).toBe(selected.revision + 1); expect(cleared.lines[0]?.selectedOffer).toBeUndefined()
  })
  it('removes by line ID without exposing arbitrary line patches', () => {
    const item = product('provider-a'); const plan = addProductToPlan(createPurchasePlan('p', 'g', 0), item, 'line')
    const removed = removePlanLine(plan, 'line'); expect(removed.lines).toEqual([]); expect(removed.revision).toBe(plan.revision + 1)
  })
  it('rebases only goal identity and revision with one plan revision increment', () => {
    const item = product('provider-a'); const plan = addProductToPlan(createPurchasePlan('p', 'g', 0), item, 'line')
    const rebased = rebasePlanToGoal(plan, 'g-next', 4)
    expect(rebased).toMatchObject({ id: plan.id, revision: plan.revision + 1, goalId: 'g-next', goalRevision: 4, lines: plan.lines })
  })
})
