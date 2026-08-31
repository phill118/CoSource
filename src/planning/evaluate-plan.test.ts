import { describe, expect, it } from 'vitest'
import { COMMERCE_PROVIDERS, type ProductCluster } from '../commerce/domain/commerce'
import { createPurchaseGoal } from '../goals/domain/purchase-goal'
import { createPurchasePlan, revisePurchasePlan, type PlanLine } from './domain/purchase-plan'
import { evaluatePurchasePlan, neutralOffer } from './evaluate-plan'

const provider = COMMERCE_PROVIDERS.shopifyGlobalCatalog
const provenance = { kind: 'provider_explicit' as const, provider }
function product(id: string, currency = 'GBP', offers = 1, minorAmount = 1000): ProductCluster {
  return { identity: { provider, id }, title: { value: id, provenance }, media: [], offerCompleteness: 'provider_returned_unknown', provenance,
    offers: Array.from({ length: offers }, (_, index) => ({ identity: { provider, id: `${id}-o${index}` }, title: { value: id, provenance },
      merchant: { identity: { provider, id: `m${index}-${id}` }, name: `M${index}`, policyLinks: [], provenance }, price: { minorAmount, currency },
      availability: { state: 'available', basis: 'catalog_signal', provenance }, selectedOptions: [], media: [], correlations: [], provenance })) }
}
const goal = createPurchaseGoal({ id: 'g', summary: 'things', requirements: [], preferences: [], exclusions: [] })
const budgetGoal = (minorAmount: number, currency = 'GBP') => createPurchaseGoal({ id: 'g', summary: 'things', budget: { minorAmount, currency }, requirements: [], preferences: [], exclusions: [] })
const line = (item: ProductCluster, changes: Partial<PlanLine> = {}): PlanLine => ({ id: item.identity.id, product: item.identity,
  productTitle: item.title.value, selectedOffer: item.offers[0]?.identity, offerSelection: 'explicit_human', quantity: 1, unitSemantics: 'single_item', ...changes })
const planFor = (items: PlanLine[]) => revisePurchasePlan(createPurchasePlan('p', 'g', 0), items)

describe('purchase plan domain', () => {
  it('preserves stable identity, goal revision, unique lines, and revision increments', () => {
    const plan = createPurchasePlan('p', goal.id, goal.revision)
    const first = line(product('a'))
    const revised = revisePurchasePlan(plan, [first])
    expect(revised).toMatchObject({ id: 'p', revision: 1, goalId: 'g', goalRevision: 0 })
    expect(() => revisePurchasePlan(revised, [first, first])).toThrow('unique')
  })
  it('uses a sole offer neutrally but requires selection among multiple offers', () => {
    expect(neutralOffer(product('one'))?.identity.id).toBe('one-o0')
    expect(neutralOffer(product('many', 'GBP', 2))).toBeUndefined()
  })
})

describe('whole-plan budget', () => {
  it('fails when individually affordable products collectively exceed the budget', () => {
    const a = product('a', 'GBP', 1, 20_000), b = product('b', 'GBP', 1, 20_000)
    const result = evaluatePurchasePlan(budgetGoal(30_000), planFor([line(a), line(b)]), [a, b])
    expect(result.budget).toMatchObject({ status: 'failed', comparableSubtotal: { minorAmount: 40_000, currency: 'GBP' }, evidence: { kind: 'cosource_derived' } })
    expect(result.status).toBe('has_known_conflicts')
  })
  it.each([[40_000, 'below'], [39_999, 'equal']])('satisfies a fully costed same-currency subtotal with budget %s (%s)', (budget) => {
    const a = product('a', 'GBP', 1, 20_000), b = product('b', 'GBP', 1, 19_999)
    const result = evaluatePurchasePlan(budgetGoal(budget), planFor([line(a), line(b)]), [a, b])
    expect(result.budget?.status).toBe('satisfied')
    expect(result.status).toBe('ready_on_known_evidence')
  })
  it('is unknown when a merchant offer is unresolved', () => {
    const item = product('multi', 'GBP', 2)
    const result = evaluatePurchasePlan(budgetGoal(5_000), planFor([line(item, { selectedOffer: undefined, offerSelection: undefined })]), [item])
    expect(result.budget?.status).toBe('unknown'); expect(result.status).not.toBe('ready_on_known_evidence')
  })
  it('is unknown when quantity semantics are unclear', () => {
    const item = product('quantity')
    const result = evaluatePurchasePlan(budgetGoal(5_000), planFor([line(item, { quantity: 2, unitSemantics: 'unknown' })]), [item])
    expect(result.budget?.status).toBe('unknown'); expect(result.knownSubtotals).toEqual([])
  })
  it('is unknown for mixed currencies and performs no FX', () => {
    const gbp = product('gbp'), usd = product('usd', 'USD')
    const result = evaluatePurchasePlan(budgetGoal(5_000), planFor([line(gbp), line(usd)]), [gbp, usd])
    expect(result.budget?.status).toBe('unknown')
    expect(result.knownSubtotals).toEqual(expect.arrayContaining([{ currency: 'GBP', minorAmount: 1000 }, { currency: 'USD', minorAmount: 1000 }]))
  })
  it('omits plan-budget evaluation when the goal has no budget', () => {
    const item = product('a'); expect(evaluatePurchasePlan(goal, planFor([line(item)]), [item]).budget).toBeUndefined()
  })
  it('detects cumulative safe-integer overflow without storing a corrupted subtotal', () => {
    const amount = Number.MAX_SAFE_INTEGER - 10
    const a = product('a', 'GBP', 1, amount), b = product('b', 'GBP', 1, 20)
    const result = evaluatePurchasePlan(budgetGoal(Number.MAX_SAFE_INTEGER), planFor([line(a), line(b)]), [a, b])
    expect(result.budget?.status).toBe('unknown')
    expect(result.knownSubtotals).toEqual([{ currency: 'GBP', minorAmount: amount }])
    expect(result.unresolvedCosts).toContain('GBP known subtotal: cumulative amount would exceed the safe integer range.')
  })
  it('keeps a known budget conflict visible when another line is incomplete', () => {
    const expensive = product('expensive', 'GBP', 1, 40_000), unresolved = product('unresolved', 'GBP', 2)
    const result = evaluatePurchasePlan(budgetGoal(30_000), planFor([line(expensive), line(unresolved, { selectedOffer: undefined, offerSelection: undefined })]), [expensive, unresolved])
    expect(result.budget?.status).toBe('unknown')
    expect(result.mandatoryFailures).toBeGreaterThan(0)
    expect(result.status).toBe('has_known_conflicts')
    expect(result.knownSubtotals).toEqual([{ currency: 'GBP', minorAmount: 40_000 }])
  })
})

describe('other plan evaluation', () => {
  it('does not resolve a product or selected offer by ID without matching its provider', () => {
    const expected = product('shared'), wrongProduct = { ...expected, identity: { provider: 'other_provider' as typeof provider, id: 'shared' } }
    const wrongOffer = { ...expected.offers[0]!, identity: { provider: 'other_provider' as typeof provider, id: expected.offers[0]!.identity.id } }
    const wrongOfferResult = evaluatePurchasePlan(goal, planFor([line(expected, { selectedOffer: wrongOffer.identity })]), [expected])
    expect(wrongOfferResult.knownSubtotals).toEqual([]); expect(wrongOfferResult.unresolvedCosts[0]).toContain('no merchant offer')
    const wrongProductResult = evaluatePurchasePlan(goal, planFor([line(expected)]), [wrongProduct])
    expect(wrongProductResult.knownSubtotals).toEqual([]); expect(wrongProductResult.unresolvedCosts[0]).toContain('product evidence is unavailable')
  })
  it('groups known currencies and never treats unresolved offers as zero', () => {
    const gbp = product('a'), usd = product('b', 'USD'), multi = product('c', 'GBP', 2)
    const result = evaluatePurchasePlan(goal, planFor([line(gbp, { quantity: 2 }), line(usd), line(multi, { selectedOffer: undefined, offerSelection: undefined })]), [gbp, usd, multi])
    expect(result.knownSubtotals).toEqual(expect.arrayContaining([{ currency: 'GBP', minorAmount: 2000 }, { currency: 'USD', minorAmount: 1000 }]))
    expect(result.unresolvedCosts[0]).toContain('no merchant offer')
  })
  it('marks changed goal revision stale', () => {
    expect(evaluatePurchasePlan({ ...goal, revision: 1 }, createPurchasePlan('p', 'g', 0), []).stale).toBe(true)
  })
})
