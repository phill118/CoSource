import { z } from 'zod'
import {moneySchema} from '../../shared/domain/money'

const boundedText = z.string().trim().min(1).max(1_000)
const shortText = z.string().trim().min(1).max(200)
const identifier = z.string().trim().min(1).max(100)
const constraintSchema = z.object({
  id: identifier,
  importance: z.enum(['required', 'preferred', 'excluded']),
  operator: z.enum(['free_text', 'equals', 'is_true', 'is_false', 'at_most', 'at_least']),
  field: shortText.optional(),
  value: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((constraint, context) => {
  if (constraint.operator !== 'free_text' && !constraint.field) {
    context.addIssue({ code: 'custom', message: 'A field is required for this operator' })
  }
  if (!['is_true', 'is_false'].includes(constraint.operator) && !constraint.value) {
    context.addIssue({ code: 'custom', message: 'A value is required for this operator' })
  }
  if (['at_most', 'at_least'].includes(constraint.operator) && !/^-?(?:\d{1,18}(?:\.\d{1,12})?|\.\d{1,12})$/.test(constraint.value ?? '')) {
    context.addIssue({ code: 'custom', message: 'A bounded decimal value is required' })
  }
})

const sourcePreferenceSchema = z.object({
  name: shortText,
  reason: z.string().trim().min(1).max(500).optional(),
}).strict()

export const resourceRequirementSchema = z.object({
  id: identifier,
  revision: z.number().int().safe().min(0),
  context: z.object({
    requester: z.object({ kind: shortText, id: identifier.optional() }).strict(),
    workspace: z.object({ kind: shortText, id: identifier.optional() }).strict().optional(),
  }).strict(),
  resource: z.object({
    type: shortText,
    purpose: boundedText,
    searchFocus: z.string().trim().min(1).max(500).optional(),
    specification: z.array(z.object({ name: shortText, value: boundedText }).strict()).max(50),
  }).strict(),
  quantity: z.object({ amount: z.number().positive().safe(), unit: shortText }).strict().optional(),
  constraints: z.array(constraintSchema).max(90),
  compatibility: z.array(z.object({ withResource: boundedText, requirement: boundedText }).strict()).max(30),
  deadline: z.object({ neededBy: z.iso.datetime({ offset: true }), timezone: shortText.optional() }).strict().optional(),
  market: z.object({
    country: z.string().regex(/^[A-Z]{2}$/).optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    language: z.string().trim().min(1).max(35).optional(),
    location: boundedText.optional(),
  }).strict().optional(),
  cost: z.object({ unitCeiling: moneySchema.optional(), totalBudget: moneySchema.optional() }).strict().optional(),
  qualityFloor: z.array(z.object({ measure: shortText, minimum: boundedText }).strict()).max(30),
  existingResources: z.array(z.object({ id: identifier, description: boundedText, quantity: z.number().positive().safe().optional() }).strict()).max(100),
  preferredSources: z.array(sourcePreferenceSchema).max(30),
  excludedSources: z.array(sourcePreferenceSchema).max(30),
  riskLimits: z.array(z.object({ category: shortText, limit: boundedText }).strict()).max(30),
  evidenceFreshness: z.object({ maximumAgeDays: z.number().int().min(0).max(3_650), requiredAsOf: z.iso.datetime({ offset: true }).optional() }).strict().optional(),
  approvalPolicy: z.object({
    consequentialDecision: z.literal('requester_approval_required'),
    fulfillmentAuthority: z.enum(['recommendation_only', 'execution_permitted_after_approval']),
    approver: shortText.optional(),
  }).strict(),
}).strict()

export type ResourceRequirement = z.infer<typeof resourceRequirementSchema>
