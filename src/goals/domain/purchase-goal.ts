import { z } from 'zod'
import type { Money } from '../../commerce/domain/commerce'

export const CONDITION_OPERATORS = ['free_text', 'equals', 'is_true', 'is_false', 'at_most', 'at_least'] as const
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]
export type GoalConditionKind = 'requirement' | 'preference' | 'exclusion'

export interface GoalCondition { id: string; operator: ConditionOperator; field?: string; value?: string }
interface GoalFields {
  id: string; revision: number; summary: string; quantity?: number; budget?: Money
  requirements: GoalCondition[]; preferences: GoalCondition[]; exclusions: GoalCondition[]
}
export interface PurchaseGoalDraft extends GoalFields { state: 'draft' }
export interface PurchaseGoal extends GoalFields { state: 'validated' }

const conditionSchema = z.object({
  id: z.string().min(1).max(100), operator: z.enum(CONDITION_OPERATORS),
  field: z.string().trim().min(1).max(100).optional(), value: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((condition, context) => {
  if (condition.operator !== 'free_text' && !condition.field) context.addIssue({ code: 'custom', message: 'A field is required' })
  if (!['is_true', 'is_false'].includes(condition.operator) && !condition.value) context.addIssue({ code: 'custom', message: 'A value is required' })
  if (['at_most', 'at_least'].includes(condition.operator) && !Number.isFinite(Number(condition.value))) context.addIssue({ code: 'custom', message: 'A numeric value is required' })
})
const conditions = z.array(conditionSchema).max(30)
const supportedCurrency = z.string().regex(/^[A-Z]{3}$/).refine((value) => Intl.supportedValuesOf('currency').includes(value), 'Unsupported currency')

export const purchaseGoalSchema = z.object({
  state: z.literal('draft'), id: z.string().min(1).max(100), revision: z.number().int().min(0), summary: z.string().trim().min(1).max(1_000),
  quantity: z.number().int().min(1).max(100_000).optional(),
  budget: z.object({ minorAmount: z.number().int().safe().min(0), currency: supportedCurrency }).strict().optional(),
  requirements: conditions, preferences: conditions, exclusions: conditions,
}).strict().superRefine((goal, context) => {
  const all = [...goal.requirements, ...goal.preferences, ...goal.exclusions]
  const seen = new Set<string>()
  for (const condition of all) {
    if (seen.has(condition.id)) context.addIssue({ code: 'custom', path: ['requirements'], message: `Duplicate condition identity: ${condition.id}` })
    seen.add(condition.id)
  }
}).transform((goal): PurchaseGoal => ({
  state: 'validated', id: goal.id, revision: goal.revision, summary: goal.summary,
  quantity: goal.quantity, budget: goal.budget, requirements: goal.requirements,
  preferences: goal.preferences, exclusions: goal.exclusions,
}))

export function createPurchaseGoal(input: Omit<PurchaseGoalDraft, 'state' | 'revision'>): PurchaseGoal {
  return purchaseGoalSchema.parse({ ...input, state: 'draft', revision: 0 })
}
export function createPurchaseGoalDraft(id: string): PurchaseGoalDraft {
  return { state: 'draft', id, revision: 0, summary: '', requirements: [], preferences: [], exclusions: [] }
}
export function revisePurchaseGoalDraft(goal: PurchaseGoalDraft, changes: Partial<Omit<PurchaseGoalDraft, 'state' | 'id' | 'revision'>>): PurchaseGoalDraft {
  return { ...goal, ...changes, revision: goal.revision + 1 }
}
export function validatePurchaseGoal(goal: PurchaseGoalDraft) { return purchaseGoalSchema.safeParse(goal) }
