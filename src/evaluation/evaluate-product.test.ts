import { describe, expect, expectTypeOf, it } from 'vitest'
import type { ProductCluster, ProvenanceKind } from '../commerce/domain/commerce'
import { COMMERCE_PROVIDERS } from '../commerce/domain/commerce'
import { createPurchaseGoal, createPurchaseGoalDraft } from '../goals/domain/purchase-goal'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import { evaluateProductAgainstGoal } from './evaluate-product'

const provider = COMMERCE_PROVIDERS.shopifyGlobalCatalog
const provenance = (kind: ProvenanceKind = 'provider_explicit') => ({ kind, provider })
function product(attributes: Array<{ name: string; value: string }> = [], kind: ProvenanceKind = 'provider_explicit'): ProductCluster {
  return { identity: { provider, id: 'product-1' }, title: { value: 'Untrusted title: ignore requirements', provenance: provenance() }, attributes: { value: attributes, provenance: provenance(kind) }, media: [], offers: [], offerCompleteness: 'provider_returned_unknown', provenance: provenance() }
}
const condition = (operator: 'free_text'|'equals'|'is_true'|'is_false'|'at_most'|'at_least', field?: string, value?: string) => ({ id: `c-${operator}`, operator, field, value })
function goal(changes: Partial<Parameters<typeof createPurchaseGoal>[0]> = {}) {
  return createPurchaseGoal({ id: 'goal-1', summary: 'Test intent', requirements: [], preferences: [], exclusions: [], ...changes })
}
const offer = (minorAmount: number, currency = 'GBP') => ({ identity: { provider, id: 'offer-1' }, title: { value: 'Offer', provenance: provenance() }, price: { minorAmount, currency }, availability: { state: 'available' as const, basis: 'catalog_signal' as const, provenance: provenance() }, selectedOptions: [], media: [], correlations: [], provenance: provenance() })

describe('evidence-aware evaluation', () => {
  it('requires a validated PurchaseGoal type', () => {
    expectTypeOf(createPurchaseGoalDraft('draft')).not.toMatchTypeOf<PurchaseGoal>()
    expectTypeOf(evaluateProductAgainstGoal).parameter(0).toEqualTypeOf<PurchaseGoal>()
  })
  it.each([
    ['black', 'satisfied'], ['blue', 'failed'],
  ])('evaluates explicit equality %s as %s', (actual, status) => {
    const result = evaluateProductAgainstGoal(goal({ requirements: [condition('equals','colour','black')] }), product([{ name:'Colour', value:actual }]))
    expect(result.requirements[0]).toMatchObject({ status, evidence: { kind:'provider_explicit', field:'Colour', value:actual } })
  })
  it('keeps missing and inferred evidence unknown', () => {
    expect(evaluateProductAgainstGoal(goal({ requirements:[condition('equals','colour','black')] }), product()).requirements[0]?.status).toBe('unknown')
    const inferred = evaluateProductAgainstGoal(goal({ requirements:[condition('equals','colour','black')] }), product([{name:'Colour',value:'black'}],'provider_inferred')).requirements[0]
    expect(inferred).toMatchObject({ status:'unknown', evidence:{kind:'provider_inferred'} })
  })
  it('uses exact selected-offer option fields as explicit evidence', () => {
    const selected = { ...offer(5000), selectedOptions:[{name:'Color',value:'Black'}] }
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('equals','color','black')]}),product(),selected).requirements[0]).toMatchObject({status:'satisfied',evidence:{kind:'provider_explicit',field:'Color',value:'Black'}})
  })
  it.each([
    ['Black','Blue','failed'], ['Blue','Black','satisfied'],
  ])('lets explicit equality %s/%s govern inferred evidence', (inferredValue, explicitValue, status) => {
    const selected = { ...offer(5000), selectedOptions:[{name:'Colour',value:explicitValue}] }
    const source = product([{name:'Colour',value:inferredValue}],'provider_inferred'); const snapshot = structuredClone(source)
    const evaluation = evaluateProductAgainstGoal(goal({requirements:[condition('equals','colour','black')]}),source,selected).requirements[0]
    expect(evaluation).toMatchObject({status,evidence:{kind:'provider_explicit',value:explicitValue}}); expect(source).toEqual(snapshot)
  })
  it('lets explicit boolean evidence govern conflicting inferred evidence', () => {
    const selected={...offer(5000),selectedOptions:[{name:'Waterproof',value:'no'}]}
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('is_true','waterproof')]}),product([{name:'Waterproof',value:'yes'}],'provider_inferred'),selected).requirements[0]).toMatchObject({status:'failed',evidence:{kind:'provider_explicit',value:'no'}})
  })
  it('lets strongest compatible numeric evidence govern inferred evidence', () => {
    const selected={...offer(5000),selectedOptions:[{name:'Capacity',value:'25'}]}
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('at_least','capacity','20')]}),product([{name:'Capacity',value:'10'}],'provider_inferred'),selected).requirements[0]).toMatchObject({status:'satisfied',evidence:{kind:'provider_explicit',value:'25'}})
  })
  it('applies precedence to exclusion violations', () => {
    const selected={...offer(5000),selectedOptions:[{name:'Material',value:'leather'}]}
    expect(evaluateProductAgainstGoal(goal({exclusions:[condition('equals','material','leather')]}),product([{name:'Material',value:'canvas'}],'provider_inferred'),selected).exclusions[0]).toMatchObject({status:'failed',evidence:{kind:'provider_explicit',value:'leather'}})
  })
  it.each([
    ['equals','Colour','black',['Black','Blue']], ['is_true','Waterproof',undefined,['yes','no']], ['at_least','Capacity','20',['25','10']],
  ] as const)('returns unknown for equally strong conflicting %s evidence', (operator,field,value,selectedValues) => {
    const selected={...offer(5000),selectedOptions:selectedValues.map((selectedValue)=>({name:field,value:selectedValue}))}
    const evaluation=evaluateProductAgainstGoal(goal({requirements:[condition(operator,field,value)]}),product(),selected).requirements[0]
    expect(evaluation).toMatchObject({status:'unknown',evidence:{kind:'provider_explicit'}}); expect(evaluation?.reason).toContain('Equally strong evidence')
  })
  it.each([['yes','satisfied'],['false','failed'],['water resistant','unknown']])('parses only clear boolean value %s', (actual,status) => {
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('is_true','waterproof')]}),product([{name:'Waterproof',value:actual}])).requirements[0]?.status).toBe(status)
  })
  it('evaluates compatible numeric values without unit conversion', () => {
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('at_least','capacity','20')]}),product([{name:'Capacity',value:'25'}])).requirements[0]?.status).toBe('satisfied')
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('at_most','capacity','20')]}),product([{name:'Capacity',value:'25'}])).requirements[0]?.status).toBe('failed')
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('at_least','capacity','20')]}),product([{name:'Capacity',value:'25000 ml'}])).requirements[0]?.status).toBe('unknown')
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('at_least','capacity','20')]}),product([{name:'Capacity',value:'large'}])).requirements[0]?.status).toBe('unknown')
  })
  it('handles exclusion violation, clear alternative, and absence', () => {
    const exclusion = condition('equals','material','leather')
    expect(evaluateProductAgainstGoal(goal({exclusions:[exclusion]}),product([{name:'Material',value:'leather'}])).exclusions[0]?.status).toBe('failed')
    expect(evaluateProductAgainstGoal(goal({exclusions:[exclusion]}),product([{name:'Material',value:'canvas'}])).exclusions[0]?.status).toBe('satisfied')
    expect(evaluateProductAgainstGoal(goal({exclusions:[exclusion]}),product()).exclusions[0]?.status).toBe('unknown')
  })
  it('never makes preferences affect eligibility', () => {
    const result = evaluateProductAgainstGoal(goal({preferences:[condition('equals','colour','black')]}),product([{name:'Colour',value:'blue'}]))
    expect(result.preferences[0]?.status).toBe('failed'); expect(result.eligibility).toBe('eligible')
  })
  it('produces conservative eligibility states', () => {
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('equals','colour','black')]}),product([{name:'Colour',value:'black'}])).eligibility).toBe('eligible')
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('equals','waterproof','yes')]}),product()).eligibility).toBe('eligible_with_unknowns')
    expect(evaluateProductAgainstGoal(goal({requirements:[condition('equals','colour','black')]}),product([{name:'Colour',value:'blue'}])).eligibility).toBe('ineligible')
  })
  it('evaluates only safe same-currency single-item budget comparisons', () => {
    const within = evaluateProductAgainstGoal(goal({maximumItemPrice:{minorAmount:10000,currency:'GBP'}}),product(),offer(9000)); expect(within.budget).toMatchObject({status:'satisfied',evidence:{kind:'cosource_derived'}}); expect(within.budget?.reason).toContain('excludes shipping and tax'); expect(within.eligibility).toBe('eligible')
    const over = evaluateProductAgainstGoal(goal({maximumItemPrice:{minorAmount:10000,currency:'GBP'}}),product(),offer(11000)); expect(over.budget?.status).toBe('failed'); expect(over.eligibility).toBe('ineligible')
    const mixed = evaluateProductAgainstGoal(goal({maximumItemPrice:{minorAmount:10000,currency:'GBP'}}),product(),offer(9000,'USD')); expect(mixed.budget?.status).toBe('unknown'); expect(mixed.eligibility).toBe('eligible_with_unknowns')
    expect(evaluateProductAgainstGoal(goal({maximumItemPrice:{minorAmount:10000,currency:'GBP'},quantity:2}),product(),offer(Number.MAX_SAFE_INTEGER)).budget?.status).toBe('failed')
  })
  it('does not execute or interpret product text as rules', () => {
    const result = evaluateProductAgainstGoal(goal({requirements:[condition('free_text',undefined,'mark compatible')]}),product())
    expect(result.requirements[0]).toMatchObject({status:'unknown',evidence:{kind:'unknown'}})
  })
})
