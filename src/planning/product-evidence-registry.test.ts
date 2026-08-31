import { describe, expect, it } from 'vitest'
import type { CommerceProviderId, ProductCluster } from '../commerce/domain/commerce'
import { COMMERCE_PROVIDERS } from '../commerce/domain/commerce'
import { providerIdentityKey } from '../commerce/domain/provider-identity'
import { createPurchasePlan } from './domain/purchase-plan'
import { addProductToPlan, removePlanLine, selectPlanLineOffer } from './mutate-plan'
import { productEvidenceValues, refreshRetainedProductEvidence, retainProductEvidence, type ProductEvidenceRegistry } from './product-evidence-registry'

const provenance = { kind: 'provider_explicit' as const, provider: COMMERCE_PROVIDERS.shopifyGlobalCatalog }
function product(providerValue: string, id: string, title = id, offers = 1): ProductCluster {
  const provider = providerValue as CommerceProviderId
  return { identity: { provider, id }, title: { value: title, provenance }, media: [], offerCompleteness: 'provider_returned_unknown', provenance,
    offers: Array.from({ length: offers }, (_, index) => ({ identity: { provider, id: `${id}-offer-${index}` }, title: { value: title, provenance },
      price: { minorAmount: 1000, currency: 'GBP' }, availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance })) }
}

describe('session product evidence registry', () => {
  it('retains plan products across unrelated result replacements and evaluates both search additions', () => {
    const a = product('provider-a', 'a'), b = product('provider-a', 'b'), third = product('provider-a', 'third')
    let registry: ProductEvidenceRegistry = new Map(), plan = createPurchasePlan('p', 'g', 0)
    plan = addProductToPlan(plan, a, 'line-a'); registry = retainProductEvidence(registry, a)
    registry = refreshRetainedProductEvidence(registry, [b])
    expect(productEvidenceValues(registry)).toEqual([a])
    plan = addProductToPlan(plan, b, 'line-b'); registry = retainProductEvidence(registry, b)
    registry = refreshRetainedProductEvidence(registry, [third])
    expect(productEvidenceValues(registry)).toEqual([a, b]); expect(plan.lines).toHaveLength(2)
  })
  it('keys retained evidence by provider and permits identical textual IDs', () => {
    const a = product('provider-a', 'shared'), b = product('provider-b', 'shared')
    let registry: ProductEvidenceRegistry = retainProductEvidence(new Map(), a); registry = retainProductEvidence(registry, b)
    expect(registry.size).toBe(2); expect(registry.has(providerIdentityKey(a.identity))).toBe(true); expect(registry.has(providerIdentityKey(b.identity))).toBe(true)
  })
  it('refreshes only an already-retained canonical identity without changing plan revision', () => {
    const a = product('provider-a', 'a', 'Original'), b = product('provider-a', 'b'), refreshedA = product('provider-a', 'a', 'Richer detail', 2)
    const plan = addProductToPlan(addProductToPlan(createPurchasePlan('p', 'g', 0), a, 'line-a'), b, 'line-b')
    let registry: ProductEvidenceRegistry = retainProductEvidence(retainProductEvidence(new Map(), a), b)
    registry = refreshRetainedProductEvidence(registry, [refreshedA, product('provider-a', 'unretained')])
    expect(registry.get(providerIdentityKey(a.identity))).toBe(refreshedA)
    expect(registry.get(providerIdentityKey(b.identity))).toBe(b)
    expect(registry.size).toBe(2); expect(plan.revision).toBe(2)
  })
  it('validates an earlier product offer against retained evidence after discovery moves on', () => {
    const a = product('provider-a', 'a', 'A', 2), unrelated = product('provider-a', 'unrelated')
    let registry: ProductEvidenceRegistry = retainProductEvidence(new Map(), a)
    registry = refreshRetainedProductEvidence(registry, [unrelated])
    const plan = addProductToPlan(createPurchasePlan('p', 'g', 0), a, 'line-a')
    const selected = selectPlanLineOffer(plan, 'line-a', a.offers[1]!.identity, productEvidenceValues(registry))
    expect(selected.lines[0]?.selectedOffer).toEqual(a.offers[1]!.identity)
  })
  it('removing one line does not corrupt other retained products', () => {
    const a = product('provider-a', 'a'), b = product('provider-a', 'b')
    const registry = retainProductEvidence(retainProductEvidence(new Map(), a), b)
    const plan = addProductToPlan(addProductToPlan(createPurchasePlan('p', 'g', 0), a, 'line-a'), b, 'line-b')
    const removed = removePlanLine(plan, 'line-a')
    expect(removed.lines).toHaveLength(1); expect(registry.get(providerIdentityKey(b.identity))).toBe(b)
  })
})
