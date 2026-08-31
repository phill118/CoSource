import { describe, expect, expectTypeOf, it } from 'vitest'
import type { PurchaseGoal } from './purchase-goal'
import { createPurchaseGoal, createPurchaseGoalDraft, purchaseGoalSchema, revisePurchaseGoalDraft, validatePurchaseGoal } from './purchase-goal'

const condition = { id: 'condition-1', operator: 'free_text' as const, value: 'waterproof' }
const base = { id: 'goal-1', summary: 'Backpack for commuting', quantity: 1, budget: { minorAmount: 12000, currency: 'GBP' }, requirements: [condition], preferences: [], exclusions: [] }

describe('purchase goal domain', () => {
  it('creates a valid provider-independent goal using canonical Money', () => {
    const goal = createPurchaseGoal(base)
    expect(goal).toMatchObject({ revision: 0, quantity: 1, budget: { minorAmount: 12000, currency: 'GBP' } })
    expect(goal.requirements).toEqual([condition]); expect(goal.preferences).toEqual([]); expect(goal.exclusions).toEqual([])
  })
  it('increments revision for meaningful edits without changing identity', () => {
    const goal = { ...createPurchaseGoalDraft('goal-1'), summary: base.summary }; const revised = revisePurchaseGoalDraft(goal, { quantity: 2 })
    expect(revised).toMatchObject({ id: 'goal-1', revision: 1, quantity: 2 })
    expect(revisePurchaseGoalDraft(revised, { summary: 'Updated intent' }).revision).toBe(2)
  })
  it('permits an empty draft but exposes only valid goals through finalisation', () => {
    const draft = createPurchaseGoalDraft('goal-1')
    expectTypeOf(draft).not.toMatchTypeOf<PurchaseGoal>()
    expect(draft).toMatchObject({ state: 'draft', summary: '' })
    expect(validatePurchaseGoal(draft).success).toBe(false)
    const edited = revisePurchaseGoalDraft(draft, { summary: 'Office chairs' })
    const validated = validatePurchaseGoal(edited)
    expect(validated.success).toBe(true)
    if (!validated.success) throw new Error('Expected valid goal')
    expect(validated.data).toMatchObject({ state: 'validated', id: draft.id, revision: edited.revision })
  })
  it.each([0, -1, 1.5, 100001])('rejects invalid quantity %s', (quantity) => {
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, quantity }).success).toBe(false)
  })
  it.each([
    { summary: '' }, { summary: 'x'.repeat(1001) },
    { budget: { minorAmount: -1, currency: 'GBP' } }, { budget: { minorAmount: 100, currency: 'gbp' } }, { budget: { minorAmount: 100, currency: 'ZZZ' } },
  ])('rejects invalid bounded goal input', (change) => {
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, ...change }).success).toBe(false)
  })
  it('rejects excessive rows and unknown operators', () => {
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, requirements: Array.from({ length: 31 }, (_, index) => ({ ...condition, id: `c-${index}` })) }).success).toBe(false)
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, requirements: [{ ...condition, operator: 'contains_magic' }] }).success).toBe(false)
  })
  it('validates structured boolean, equality, numeric, and free-text forms', () => {
    const requirements = [
      { id: 'a', operator: 'equals', field: 'colour', value: 'black' },
      { id: 'b', operator: 'is_true', field: 'waterproof' },
      { id: 'c', operator: 'at_least', field: 'capacity', value: '20' }, condition,
    ]
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, requirements }).success).toBe(true)
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, requirements: [{ id: 'x', operator: 'at_most', field: 'size', value: 'large' }] }).success).toBe(false)
  })
  it('rejects duplicate condition identities within and across collections', () => {
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, requirements: [condition, condition] }).success).toBe(false)
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, preferences: [condition] }).success).toBe(false)
    expect(purchaseGoalSchema.safeParse({ ...base, state: 'draft', revision: 0, preferences: [{ ...condition, id: 'unique-2' }] }).success).toBe(true)
  })
})
