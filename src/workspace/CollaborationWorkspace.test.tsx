// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { COMMERCE_PROVIDERS, type ProductCluster } from '../commerce/domain/commerce'
import { createPurchaseGoal } from '../goals/domain/purchase-goal'
import { createPurchasePlan } from '../planning/domain/purchase-plan'
import { evaluatePurchasePlan } from '../planning/evaluate-plan'
import type { PlanChangeProposal } from '../proposals/domain/plan-change-proposal'
import { CollaborationWorkspace } from './CollaborationWorkspace'

const provider = COMMERCE_PROVIDERS.shopifyGlobalCatalog
const provenance = { kind: 'provider_explicit' as const, provider }
const product: ProductCluster = { identity: { provider, id: 'p' }, title: { value: 'Retained product', provenance }, media: [], offerCompleteness: 'provider_returned_unknown', provenance, offers: [] }
const goal = createPurchaseGoal({ id: 'g', summary: 'Product', requirements: [], preferences: [], exclusions: [] })
const plan = createPurchasePlan('plan', 'g', 0)
const evaluation = evaluatePurchasePlan(goal, plan, [product])
const proposal: PlanChangeProposal = { id: 'proposal-1', status: 'pending', createdAt: '2026-09-02T00:00:00Z', source: 'agent_webmcp', planId: 'plan', expectedPlanRevision: 0, expectedGoalId: 'g', expectedGoalRevision: 0, operations: [{ type: 'add_retained_product', product: product.identity, lineId: 'line' }] }

afterEach(cleanup)

describe('collaboration destination', () => {
  it('starts Review with pending human approval controls and keeps WebMCP together', () => {
    render(<CollaborationWorkspace proposals={[proposal]} plan={plan} products={[product]} onApprove={vi.fn()} onReject={vi.fn()} getReview={() => ({ ok: true, value: { status: 'pending', before: evaluation, after: evaluation } })} status="ready" toolCount={13} activities={[]}/>)
    const review = document.querySelector('#stage-review')!
    expect(review.querySelector('button')).toHaveTextContent('Approve and apply')
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(screen.getByText('WebMCP ready')).toBeInTheDocument()
  })

  it('uses one compact proposal empty state and preserves unavailable readiness', () => {
    render(<CollaborationWorkspace proposals={[]} plan={plan} products={[]} onApprove={vi.fn()} onReject={vi.fn()} getReview={() => ({ ok: false, code: 'invalid_proposal', message: 'unused' })} status="unavailable" toolCount={0} activities={[]}/>)
    expect(screen.getAllByText(/No agent plan proposals this session/)).toHaveLength(1)
    expect(screen.getByText('WebMCP unavailable in this browser')).toBeInTheDocument()
  })
})
