import type { Money, ProductCluster, ProvenanceKind } from '../../commerce/domain/commerce'
import type { GoalCondition, GoalConditionKind } from '../../goals/domain/purchase-goal'
import type { DecisionReadiness, EvidenceFreshness } from '../../evidence/domain/evidence'
import type {CostAssessment} from '../../costing/domain/cost'
import type {SupplierAssessment} from '../../suppliers/domain/supplier-intelligence'

export type EvaluationStatus = 'satisfied' | 'failed' | 'unknown'
export type EligibilityStatus = 'eligible' | 'eligible_with_unknowns' | 'ineligible'
export interface EvaluationEvidence { kind: ProvenanceKind; field?: string; value?: string }
export interface ConditionEvaluation {
  conditionId: string; kind: GoalConditionKind; condition: GoalCondition; status: EvaluationStatus
  evidence: EvaluationEvidence; reason: string; issue?:'missing'|'inferred'|'conflict'
}
export interface BudgetEvaluation { status: EvaluationStatus; evidence: EvaluationEvidence; reason: string; itemPrice?: Money;issue?:'missing'|'inferred'|'conflict' }
export interface ProductEvaluation {
  goalId: string; goalRevision: number; productId: string; eligibility: EligibilityStatus
  requirements: ConditionEvaluation[]; preferences: ConditionEvaluation[]; exclusions: ConditionEvaluation[]
  budget?: BudgetEvaluation
  costAssessment?: CostAssessment
  counts: { satisfied: number; failed: number; unknown: number }
  evidence?:{observedAt?:string;freshness:EvidenceFreshness}
  readiness?:DecisionReadiness
  readinessReasons?:string[]
  supplier?:SupplierAssessment
}

export type EvaluationProduct = Pick<ProductCluster, 'identity' | 'attributes' | 'options'>
