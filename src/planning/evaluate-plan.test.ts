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
const completeCoverage={status:'complete' as const,evidence:{strength:'source_explicit' as const,source:'fixture'}}
const completelyCosted=(item:ProductCluster):ProductCluster=>({...item,offers:item.offers.map(offer=>({...offer,oneTimeCostCoverage:completeCoverage}))})

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
  it.each([
    ['unavailable','provider_explicit','blocked_by_known_failure'],
    ['unknown','provider_explicit','insufficient_evidence'],
    ['available','provider_inferred','verification_required'],
  ] as const)('applies canonical %s/%s selected-offer availability', (state,kind,readiness) => {
    const readinessGoal=createPurchaseGoal({id:'g',summary:'sized',requirements:[{id:'size',operator:'equals',field:'Size',value:'large'}],preferences:[],exclusions:[]}),base=completelyCosted(product('availability')),item={...base,attributes:{value:[{name:'Size',value:'large'}],provenance},offers:base.offers.map(offer=>({...offer,availability:{...offer.availability,state,provenance:{kind,provider}}}))}
    expect(evaluatePurchasePlan(readinessGoal,planFor([line(item)]),[item]).readiness).toBe(readiness)
  })
  it('keeps absent quantity and merchant identity unresolved instead of treating them as one and zero',()=>{const base=completelyCosted(product('unknowns')),item={...base,offers:base.offers.map(offer=>({...offer,merchant:undefined}))},result=evaluatePurchasePlan(goal,planFor([line(item,{quantity:undefined})]),[item]);expect(result.readiness).toBe('insufficient_evidence');expect(result.merchantCount).toBe(0);expect(result.readinessReasons?.join(' ')).toMatch(/quantity.*unresolved|merchant identity/i);expect(result.costAssessment?.completeness).not.toBe('complete_exact')})
})

describe('whole-plan budget', () => {
  it('preserves an unavoidable plan lower bound when only an addition maximum overflows',()=>{const item=completelyCosted(product('bounded','GBP',1,100)),costed={...item,offers:item.offers.map(offer=>({...offer,costComponents:[{id:'delivery',category:'delivery' as const,effect:'addition' as const,basis:'per_line' as const,applicability:'applies' as const,knowledge:{kind:'range' as const,minimum:{minorAmount:50,currency:'GBP'},maximum:{minorAmount:Number.MAX_SAFE_INTEGER,currency:'GBP'}},timing:'one_time' as const,evidence:{strength:'source_explicit' as const,source:'fixture'}}]}))},result=evaluatePurchasePlan(budgetGoal(120),planFor([line(costed)]),[costed]);expect(result).toMatchObject({status:'has_known_conflicts',budget:{status:'failed',comparableSubtotal:{minorAmount:150,currency:'GBP'}},costAssessment:{completeness:'incomplete',currencyTotals:[{baseSubtotal:{minorAmount:100,currency:'GBP'},knownAdditions:{minorAmount:50,currency:'GBP'},knownLowerBound:{minorAmount:150,currency:'GBP'},upperBound:undefined,exactLandedTotal:undefined}]}})})
  it('costs the actual explicitly selected offer without changing plan revision',()=>{const item=completelyCosted(product('selected','GBP',2,1000)),selected={...item,offers:[item.offers[0]!,{...item.offers[1]!,price:{minorAmount:2500,currency:'GBP'},oneTimeCostCoverage:completeCoverage}]},plan=planFor([line(selected,{selectedOffer:selected.offers[1]!.identity})]),revision=plan.revision,result=evaluatePurchasePlan(budgetGoal(3000),plan,[selected]);expect(result.costAssessment?.currencyTotals[0]?.exactLandedTotal).toEqual({minorAmount:2500,currency:'GBP'});expect(plan.revision).toBe(revision)})
  it('fails when individually affordable products collectively exceed the budget', () => {
    const a = product('a', 'GBP', 1, 20_000), b = product('b', 'GBP', 1, 20_000)
    const result = evaluatePurchasePlan(budgetGoal(30_000), planFor([line(a), line(b)]), [a, b])
    expect(result.budget).toMatchObject({ status: 'failed', comparableSubtotal: { minorAmount: 40_000, currency: 'GBP' }, evidence: { kind: 'cosource_derived' } })
    expect(result.status).toBe('has_known_conflicts')
  })
  it.each([[40_000, 'below'], [39_999, 'equal']])('satisfies a fully costed same-currency subtotal with budget %s (%s)', (budget) => {
    const a = completelyCosted(product('a', 'GBP', 1, 20_000)), b = completelyCosted(product('b', 'GBP', 1, 19_999))
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
    expect(result.knownSubtotals).toEqual([{currency:'GBP',minorAmount:20}])
    expect(result.unresolvedCosts).toContain('One or more cost components exceed the safe aggregate range and remain unresolved.')
  })
  it('keeps a known budget conflict visible when another line is incomplete', () => {
    const expensive = product('expensive', 'GBP', 1, 40_000), unresolved = product('unresolved', 'GBP', 2)
    const result = evaluatePurchasePlan(budgetGoal(30_000), planFor([line(expensive), line(unresolved, { selectedOffer: undefined, offerSelection: undefined })]), [expensive, unresolved])
    expect(result.budget?.status).toBe('failed')
    expect(result.mandatoryFailures).toBe(0)
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
  it('keeps an empty placeholder plan neutral after a goal revision change', () => {
    expect(evaluatePurchasePlan({ ...goal, revision: 1 }, createPurchasePlan('p', 'g', 0), []).stale).toBe(false)
  })
})
