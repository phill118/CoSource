import type { Money } from '../commerce/domain/commerce'
import type { PurchaseGoal } from '../goals/domain/purchase-goal'
import { resourceRequirementSchema, type ResourceRequirement } from './domain/resource-requirement'

interface ProjectionContext {
  market: { country: string; currency: string; language?: string }
  workspaceId?: string
}

function money(value: Money | undefined) {
  return value ? { minorAmount: value.minorAmount, currency: value.currency } : undefined
}

export function projectPurchaseGoalToResourceRequirement(
  goal: PurchaseGoal,
  context: ProjectionContext,
): ResourceRequirement {
  const cost = goal.maximumItemPrice || goal.budget
    ? { unitCeiling: money(goal.maximumItemPrice), totalBudget: money(goal.budget) }
    : undefined
  const constraints = [
    ...goal.requirements.map((condition) => ({ ...condition, importance: 'required' as const })),
    ...goal.preferences.map((condition) => ({ ...condition, importance: 'preferred' as const })),
    ...goal.exclusions.map((condition) => ({ ...condition, importance: 'excluded' as const })),
  ]

  return resourceRequirementSchema.parse({
    id: goal.id,
    revision: goal.revision,
    context: {
      requester: { kind: 'standalone_human' },
      workspace: { kind: 'cosource_purchasing', id: context.workspaceId },
    },
    resource: {
      type: 'product',
      purpose: goal.summary,
      searchFocus: goal.searchFocus,
      specification: [],
    },
    quantity: goal.quantity ? { amount: goal.quantity, unit: 'item' } : undefined,
    constraints,
    compatibility: [],
    market: { ...context.market },
    cost,
    qualityFloor: [],
    existingResources: [],
    preferredSources: [],
    excludedSources: [],
    riskLimits: [],
    approvalPolicy: {
      consequentialDecision: 'requester_approval_required',
      fulfillmentAuthority: 'recommendation_only',
    },
  })
}
