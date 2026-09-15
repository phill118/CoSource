// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { ApplicationActivity } from '../application/cosource-application'
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
    expect(screen.getByRole('button',{name:'Approve and apply'})).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(screen.getByText(/WebMCP ready/)).toBeInTheDocument()
  })

  it('uses one compact proposal empty state and preserves unavailable readiness', () => {
    render(<CollaborationWorkspace proposals={[]} plan={plan} products={[]} onApprove={vi.fn()} onReject={vi.fn()} getReview={() => ({ ok: false, code: 'invalid_proposal', message: 'unused' })} status="unavailable" toolCount={0} activities={[]}/>)
    expect(screen.getAllByText(/No pending agent plan proposals/)).toHaveLength(1)
    expect(screen.getByText(/WebMCP unavailable in this browser/)).toBeInTheDocument()
  })

  it('shows only canonical pending proposals without mutating proposal history', () => {
    const history:PlanChangeProposal[]=[{...proposal,id:'rejected',status:'rejected'},{...proposal,id:'applied',status:'applied'},{...proposal,id:'stale',status:'stale'}]
    const before=history.map(item=>item.status)
    render(<CollaborationWorkspace proposals={history} plan={plan} products={[product]} onApprove={vi.fn()} onReject={vi.fn()} getReview={() => ({ ok: true, value: { status: 'rejected', before: evaluation } })} status="ready" toolCount={13} activities={[]}/>)
    expect(screen.getByText('No pending agent plan proposals.')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Approve and apply'})).not.toBeInTheDocument()
    expect(history.map(item=>item.status)).toEqual(before)
  })

  it('classifies human, agent and applied activity into exclusive review views', async () => {
    const activity=(id:number,kind:ApplicationActivity['kind'],toolName:string,summary:string):ApplicationActivity=>({id,timestamp:'2026-09-15T12:00:00.000Z',kind,toolName,outcome:'success',summary})
    const activities=[
      activity(1,'human_verification_recorded','human_record_verification','Human verification'),
      activity(2,'supplier_evidence_recorded','human_supplier_operation','Supplier operation'),
      activity(3,'scenario_applied','human_apply_scenario','Scenario application'),
      activity(4,'operational_case_updated','human_operational_operation','Operational action'),
      activity(5,'goal_committed','human_commit_goal','Goal commitment'),
      activity(6,'proposal_rejected','human_reject','Proposal rejection'),
      activity(7,'interpretation_adopted','human_adopt_interpretation','Interpretation adoption'),
      activity(8,'interpretation_rejected','human_reject_interpretation','Interpretation rejection'),
      activity(9,'read_tool_call','get_purchase_plan','Agent read'),
      activity(10,'proposal_applied','human_approve_and_apply','Applied proposal'),
    ]
    render(<CollaborationWorkspace proposals={[]} plan={plan} products={[]} onApprove={vi.fn()} onReject={vi.fn()} getReview={() => ({ ok: false, code: 'invalid_proposal', message: 'unused' })} status="ready" toolCount={13} activities={activities}/>)
    await userEvent.click(screen.getByRole('button',{name:'Human decisions'}))
    for(const summary of ['Human verification','Supplier operation','Scenario application','Operational action','Goal commitment','Proposal rejection','Interpretation adoption','Interpretation rejection'])expect(screen.getByText(summary)).toBeInTheDocument()
    expect(screen.queryByText('Agent read')).not.toBeInTheDocument();expect(screen.queryByText('Applied proposal')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button',{name:'Agent activity'}));expect(screen.getByText('Agent read')).toBeInTheDocument();expect(screen.queryByText('Human verification')).not.toBeInTheDocument();expect(screen.queryByText('Applied proposal')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button',{name:'Applied changes'}));expect(screen.getByText('Applied proposal')).toBeInTheDocument();expect(screen.queryByText('Human verification')).not.toBeInTheDocument();expect(screen.queryByText('Agent read')).not.toBeInTheDocument()
  })
})
