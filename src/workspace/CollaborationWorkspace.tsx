import type { ApplicationActivity, ApplicationResult } from '../application/cosource-application'
import type { ProductCluster } from '../commerce/domain/commerce'
import type { PlanEvaluation, PurchasePlan } from '../planning/domain/purchase-plan'
import type { PlanChangeProposal } from '../proposals/domain/plan-change-proposal'
import { ProposalReviewPanel } from '../proposals/ProposalReviewPanel'
import type { WebMCPStatus } from '../webmcp/use-webmcp'
import { WebMCPStatusPanel } from '../webmcp/WebMCPStatusPanel'

export function CollaborationWorkspace({ proposals, plan, products, onApprove, onReject, getReview, status, toolCount, activities }: {
  proposals: PlanChangeProposal[]; plan: PurchasePlan; products: ProductCluster[]; onApprove: (id: string) => void; onReject: (id: string) => void
  getReview: (id: string) => ApplicationResult<{ status: PlanChangeProposal['status']; before: PlanEvaluation; after?: PlanEvaluation }>
  status: WebMCPStatus; toolCount: number; activities: ApplicationActivity[]
}) {
  return <section id="stage-review" className="collaboration-workspace" aria-labelledby="collaboration-title">
    <div className="collaboration-heading"><p className="eyebrow">Review · Human approval and agent activity</p><h2 id="collaboration-title">Agent collaboration</h2></div>
    {proposals.length > 0 ? <ProposalReviewPanel proposals={proposals} plan={plan} products={products} onApprove={onApprove} onReject={onReject} getReview={getReview}/> : <div className="proposal-empty"><strong>No agent plan proposals this session.</strong><span>Agents may propose bounded plan changes; only you can approve and apply them.</span></div>}
    <WebMCPStatusPanel status={status} toolCount={toolCount} activities={activities}/>
  </section>
}
