import type { Money, ProductCluster, ProvenanceKind } from '../../commerce/domain/commerce'
import type { GoalCondition, GoalConditionKind } from '../../goals/domain/purchase-goal'

export type EvaluationStatus = 'satisfied' | 'failed' | 'unknown'
export type EligibilityStatus = 'eligible' | 'eligible_with_unknowns' | 'ineligible'
export interface EvaluationEvidence { kind: ProvenanceKind; field?: string; value?: string }
export interface ConditionEvaluation {
  conditionId: string; kind: GoalConditionKind; condition: GoalCondition; status: EvaluationStatus
  evidence: EvaluationEvidence; reason: string
}
export interface BudgetEvaluation { status: EvaluationStatus; evidence: EvaluationEvidence; reason: string; itemPrice?: Money }
export interface ProductEvaluation {
  goalId: string; goalRevision: number; productId: string; eligibility: EligibilityStatus
  requirements: ConditionEvaluation[]; preferences: ConditionEvaluation[]; exclusions: ConditionEvaluation[]
  budget?: BudgetEvaluation
  counts: { satisfied: number; failed: number; unknown: number }
}

export type EvaluationProduct = Pick<ProductCluster, 'identity' | 'attributes' | 'options'>
