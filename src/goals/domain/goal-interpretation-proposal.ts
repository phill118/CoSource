import {z} from 'zod'
import type {PurchaseGoalDraft} from './purchase-goal'
import {goalValuesSchema} from './purchase-goal'

export const MAX_INTERPRETATION_ITEMS=20
const boundedText=z.string().trim().min(1).max(500)
export const goalInterpretationInputSchema=z.object({
 sessionId:z.string().min(1).max(100),draftId:z.string().min(1).max(100),draftRevision:z.number().int().min(0),proposed:goalValuesSchema,
 interpretationNotes:z.string().trim().min(1).max(2_000),assumptions:z.array(boundedText).max(MAX_INTERPRETATION_ITEMS),unresolvedQuestions:z.array(boundedText).max(MAX_INTERPRETATION_ITEMS),
}).strict()
export type GoalInterpretationInput=z.infer<typeof goalInterpretationInputSchema>
export type GoalInterpretationReviewStatus='pending'|'adopted'|'rejected'|'superseded'
export interface GoalInterpretationProposal extends GoalInterpretationInput{id:string;createdAt:string;status:GoalInterpretationReviewStatus}
export type GoalInterpretationEffectiveStatus=GoalInterpretationReviewStatus|'stale'

export const proposalEffectiveStatus=(proposal:GoalInterpretationProposal,sessionId:string,draft:PurchaseGoalDraft):GoalInterpretationEffectiveStatus=>proposal.status==='pending'&&(proposal.sessionId!==sessionId||proposal.draftId!==draft.id||proposal.draftRevision!==draft.revision)?'stale':proposal.status
