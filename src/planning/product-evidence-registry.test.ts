import { describe, expect, it } from 'vitest'
import type { CommerceProviderId, ProductCluster } from '../commerce/domain/commerce'
import { COMMERCE_PROVIDERS } from '../commerce/domain/commerce'
import { providerIdentityKey } from '../commerce/domain/provider-identity'
import { createPurchasePlan } from './domain/purchase-plan'
import { addProductToPlan, removePlanLine, selectPlanLineOffer } from './mutate-plan'
import {assessEvidenceFreshness} from '../evidence/domain/evidence'
import {PRODUCT_EVIDENCE_ENTRY_LIMIT,PRODUCT_EVIDENCE_HISTORY_LIMIT,productEvidenceValues,observeProductEvidence,type ProductEvidenceLedger} from '../evidence/product-evidence-ledger'

const provenance = { kind: 'provider_explicit' as const, provider: COMMERCE_PROVIDERS.shopifyGlobalCatalog }
function product(providerValue: string, id: string, title = id, offers = 1): ProductCluster {
  const provider = providerValue as CommerceProviderId
  return { identity: { provider, id }, title: { value: title, provenance }, media: [], offerCompleteness: 'provider_returned_unknown', provenance,
    offers: Array.from({ length: offers }, (_, index) => ({ identity: { provider, id: `${id}-offer-${index}` }, title: { value: title, provenance },
      price: { minorAmount: 1000, currency: 'GBP' }, availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance })) }
}

describe('session product evidence registry', () => {
  it('retains plan products across unrelated result replacements and evaluates both search additions', () => {
    const a = product('provider-a', 'a'), b = product('provider-a', 'b')
    let registry: ProductEvidenceLedger = new Map(), plan = createPurchasePlan('p', 'g', 0)
    plan = addProductToPlan(plan, a, 'line-a'); registry = observeProductEvidence(registry, a, '2026-01-01T00:00:00Z', 'o1')
    expect(productEvidenceValues(registry)).toEqual([a])
    plan = addProductToPlan(plan, b, 'line-b'); registry = observeProductEvidence(registry, b, '2026-01-01T00:00:01Z', 'o2')
    expect(productEvidenceValues(registry)).toEqual([a, b]); expect(plan.lines).toHaveLength(2)
  })
  it('keys retained evidence by provider and permits identical textual IDs', () => {
    const a = product('provider-a', 'shared'), b = product('provider-b', 'shared')
    let registry: ProductEvidenceLedger = observeProductEvidence(new Map(), a, '2026-01-01T00:00:00Z', 'a'); registry = observeProductEvidence(registry, b, '2026-01-01T00:00:00Z', 'b')
    expect(registry.size).toBe(2); expect(registry.has(providerIdentityKey(a.identity))).toBe(true); expect(registry.has(providerIdentityKey(b.identity))).toBe(true)
  })
  it('refreshes only an already-retained canonical identity without changing plan revision', () => {
    const a = product('provider-a', 'a', 'Original'), b = product('provider-a', 'b'), refreshedA = product('provider-a', 'a', 'Richer detail', 2)
    const plan = addProductToPlan(addProductToPlan(createPurchasePlan('p', 'g', 0), a, 'line-a'), b, 'line-b')
    let registry: ProductEvidenceLedger = observeProductEvidence(observeProductEvidence(new Map(), a, '2026-01-01T00:00:00Z', 'a1'), b, '2026-01-01T00:00:00Z', 'b1')
    registry = observeProductEvidence(registry, refreshedA, '2026-01-02T00:00:00Z', 'a2')
    expect(registry.get(providerIdentityKey(a.identity))?.current.product).toBe(refreshedA)
    expect(registry.get(providerIdentityKey(a.identity))?.history[0]).toMatchObject({id:'a1',supersededBy:'a2'})
    expect(registry.get(providerIdentityKey(b.identity))?.current.product).toBe(b)
    expect(registry.size).toBe(2); expect(plan.revision).toBe(2)
  })
  it('validates an earlier product offer against retained evidence after discovery moves on', () => {
    const a = product('provider-a', 'a', 'A', 2)
    const registry: ProductEvidenceLedger = observeProductEvidence(new Map(), a, '2026-01-01T00:00:00Z', 'a')
    const plan = addProductToPlan(createPurchasePlan('p', 'g', 0), a, 'line-a')
    const selected = selectPlanLineOffer(plan, 'line-a', a.offers[1]!.identity, productEvidenceValues(registry))
    expect(selected.lines[0]?.selectedOffer).toEqual(a.offers[1]!.identity)
  })
  it('removing one line does not corrupt other retained products', () => {
    const a = product('provider-a', 'a'), b = product('provider-a', 'b')
    const registry = observeProductEvidence(observeProductEvidence(new Map(), a, '2026-01-01T00:00:00Z', 'a'), b, '2026-01-01T00:00:00Z', 'b')
    const plan = addProductToPlan(addProductToPlan(createPurchasePlan('p', 'g', 0), a, 'line-a'), b, 'line-b')
    const removed = removePlanLine(plan, 'line-a')
    expect(removed.lines).toHaveLength(1); expect(registry.get(providerIdentityKey(b.identity))?.current.product).toBe(b)
  })
  it('keeps deterministic bounded superseded history and advances identical re-observation time',()=>{const item=product('provider-a','a');let registry:ProductEvidenceLedger=new Map();for(let index=0;index<8;index++)registry=observeProductEvidence(registry,item,`2026-01-0${index+1}T00:00:00Z`,`o${index}`);const entry=registry.get(providerIdentityKey(item.identity))!;expect(entry.current).toMatchObject({id:'o7',sequence:8,observedAt:'2026-01-08T00:00:00.000Z'});expect(entry.history).toHaveLength(PRODUCT_EVIDENCE_HISTORY_LIMIT);expect(entry.history.map(item=>item.id)).toEqual(['o6','o5','o4','o3','o2'])})
  it('bounds retained subjects without evicting accepted evidence',()=>{let ledger:ProductEvidenceLedger=new Map();for(let index=0;index<PRODUCT_EVIDENCE_ENTRY_LIMIT+1;index++)ledger=observeProductEvidence(ledger,product('provider-a',`p${index}`),'2026-01-01T00:00:00Z',`o${index}`);expect(ledger.size).toBe(PRODUCT_EVIDENCE_ENTRY_LIMIT);expect(ledger.has(providerIdentityKey(product('provider-a','p0').identity))).toBe(true);expect(ledger.has(providerIdentityKey(product('provider-a',`p${PRODUCT_EVIDENCE_ENTRY_LIMIT}`).identity))).toBe(false)})
  it('applies deterministic freshness boundaries',()=>{const observed='2026-01-01T00:00:00Z';expect(assessEvidenceFreshness(observed,undefined,'2026-01-20T00:00:00Z')).toBe('not_constrained');expect(assessEvidenceFreshness(observed,{maximumAgeDays:1},'2026-01-02T00:00:00Z')).toBe('current');expect(assessEvidenceFreshness(observed,{maximumAgeDays:1},'2026-01-02T00:00:00.001Z')).toBe('stale');expect(assessEvidenceFreshness(undefined,{maximumAgeDays:1},'2026-01-02T00:00:00Z')).toBe('unknown');expect(assessEvidenceFreshness(observed,{requiredAsOf:'2026-01-02T00:00:00Z'},'2026-01-03T00:00:00Z')).toBe('stale')})
})
