import { describe, expect, it } from 'vitest'
import { createPurchaseGoal } from '../../goals/domain/purchase-goal'
import {
  resourceRequirementSchema,
} from './resource-requirement'
import { projectPurchaseGoalToResourceRequirement } from '../purchase-goal-projection'

describe('canonical resource requirement', () => {
  it('accepts a bounded non-retail service requirement', () => {
    expect(resourceRequirementSchema.parse({
      id: 'security-audit-1', revision: 2,
      context: { requester: { kind: 'corap_presence_os', id: 'presence-1' } },
      resource: { type: 'professional_service', purpose: 'Audit an accessible public website', specification: [{ name: 'standard', value: 'WCAG 2.2 AA' }] },
      constraints: [], compatibility: [], qualityFloor: [{ measure: 'assessor qualification', minimum: 'Independent accredited assessor' }],
      existingResources: [], preferredSources: [], excludedSources: [], riskLimits: [{ category: 'data access', limit: 'No production credentials' }],
      evidenceFreshness: { maximumAgeDays: 30 },
      approvalPolicy: { consequentialDecision: 'requester_approval_required', fulfillmentAuthority: 'recommendation_only' },
    }).resource.type).toBe('professional_service')
  })

  it('rejects provider leakage, unknown fields, and unbounded collections', () => {
    const base = {
      id: 'r', revision: 0, context: { requester: { kind: 'standalone' } },
      resource: { type: 'material', purpose: 'Source recycled board', specification: [] },
      constraints: [], compatibility: [], qualityFloor: [], existingResources: [], preferredSources: [], excludedSources: [], riskLimits: [],
      approvalPolicy: { consequentialDecision: 'requester_approval_required', fulfillmentAuthority: 'recommendation_only' },
    }
    expect(resourceRequirementSchema.safeParse({ ...base, provider: 'shopify_global_catalog' }).success).toBe(false)
    expect(resourceRequirementSchema.safeParse({
      ...base,
      resource: { ...base.resource, shopifyProductId: 'gid://shopify/p/123' },
    }).success).toBe(false)
    expect(resourceRequirementSchema.safeParse({ ...base, preferredSources: Array.from({ length: 31 }, (_, index) => ({ name: `source-${index}` })) }).success).toBe(false)
  })

  it('projects every purchase field deterministically with exact money', () => {
    const goal = createPurchaseGoal({
      id: 'goal-1', summary: 'Equip a field team', searchFocus: 'waterproof backpacks', quantity: 30,
      maximumItemPrice: { minorAmount: 3_501, currency: 'GBP' }, budget: { minorAmount: 105_001, currency: 'GBP' },
      requirements: [{ id: 'waterproof', operator: 'free_text', value: 'Waterproof' }],
      preferences: [{ id: 'reflective', operator: 'is_true', field: 'reflective' }],
      exclusions: [{ id: 'leather', operator: 'free_text', value: 'Leather' }],
    })
    const context = { market: { country: 'GB', currency: 'GBP' }, workspaceId: 'session-1' }
    const first = projectPurchaseGoalToResourceRequirement(goal, context)
    const second = projectPurchaseGoalToResourceRequirement(goal, context)
    expect(second).toEqual(first)
    expect(first).toMatchObject({
      id: goal.id, revision: goal.revision,
      resource: { type: 'product', purpose: goal.summary, searchFocus: goal.searchFocus },
      quantity: { amount: 30, unit: 'item' },
      cost: { unitCeiling: { minorAmount: 3_501 }, totalBudget: { minorAmount: 105_001 } },
      constraints: [
        { id: 'waterproof', importance: 'required' },
        { id: 'reflective', importance: 'preferred' },
        { id: 'leather', importance: 'excluded' },
      ],
    })
    expect(JSON.stringify(first)).not.toContain('shopify')
  })
})
