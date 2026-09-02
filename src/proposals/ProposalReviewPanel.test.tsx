// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,describe,expect,it,vi} from 'vitest'
import '@testing-library/jest-dom/vitest'
import {COMMERCE_PROVIDERS,type ProductCluster} from '../commerce/domain/commerce'
import {createPurchaseGoal} from '../goals/domain/purchase-goal'
import {createPurchasePlan} from '../planning/domain/purchase-plan'
import {evaluatePurchasePlan} from '../planning/evaluate-plan'
import type {PlanChangeProposal} from './domain/plan-change-proposal'
import {ProposalReviewPanel} from './ProposalReviewPanel'
const provider=COMMERCE_PROVIDERS.shopifyGlobalCatalog,provenance={kind:'provider_explicit' as const,provider},product:ProductCluster={identity:{provider,id:'p'},title:{value:'Real retained product',provenance},media:[],offerCompleteness:'provider_returned_unknown',provenance,offers:[]},goal=createPurchaseGoal({id:'g',summary:'Product',requirements:[],preferences:[],exclusions:[]}),plan=createPurchasePlan('plan','g',0),evaluation=evaluatePurchasePlan(goal,plan,[product])
const proposal:PlanChangeProposal={id:'proposal-1',status:'pending',createdAt:'2026-08-31T00:00:00Z',source:'agent_webmcp',planId:'plan',expectedPlanRevision:0,expectedGoalId:'g',expectedGoalRevision:0,reason:'Use retained evidence',operations:[{type:'add_retained_product',product:product.identity,lineId:'new-line'}]}
afterEach(cleanup)
describe('proposal review UI',()=>{
 it('renders an application-owned preview and delegates approval/rejection',async()=>{const approve=vi.fn(),reject=vi.fn();render(<ProposalReviewPanel proposals={[proposal]} plan={plan} products={[product]} onApprove={approve} onReject={reject} getReview={()=>({ok:true,value:{status:'pending',before:evaluation,after:evaluation}})}/>);expect(screen.getByText(/Add retained product: Real retained product/)).toBeInTheDocument();expect(screen.getByRole('heading',{name:'Before'})).toBeInTheDocument();expect(screen.getByRole('heading',{name:'After preview'})).toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:'Approve and apply'}));expect(approve).toHaveBeenCalledWith('proposal-1');await userEvent.click(screen.getByRole('button',{name:'Reject'}));expect(reject).toHaveBeenCalledWith('proposal-1')})
 it('renders application-owned stale status without approval',()=>{render(<ProposalReviewPanel proposals={[proposal]} plan={{...plan,revision:1}} products={[product]} onApprove={vi.fn()} onReject={vi.fn()} getReview={()=>({ok:true,value:{status:'stale',before:evaluation}})}/>);expect(screen.getByRole('alert')).toHaveTextContent('This proposal is stale');expect(screen.queryByRole('button',{name:'Approve and apply'})).not.toBeInTheDocument()})
})
