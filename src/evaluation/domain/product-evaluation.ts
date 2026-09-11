import type { Money, ProductCluster, ProvenanceKind } from '../../commerce/domain/commerce'
import type { GoalCondition, GoalConditionKind } from '../../goals/domain/purchase-goal'
import type { DecisionReadiness, EvidenceFreshness } from '../../evidence/domain/evidence'
import type {CostAssessment} from '../../costing/domain/cost'
import type {SupplierAssessment} from '../../suppliers/domain/supplier-intelligence'

export type EvaluationStatus = 'satisfied' | 'failed' | 'unknown'
export type EligibilityStatus = 'eligible' | 'eligible_with_unknowns' | 'ineligible'
export interface EvaluationEvidence { kind: ProvenanceKind|'human_verified'; field?: string; value?: string;source?:string }
export interface EvaluationClaim{id:string;field:string;value:string;provenance:ProvenanceKind}
export interface HumanEvaluationDecision{conditionId:string;outcome:'confirmed'|'rejected'|'recorded'|'requires_verification';claimReference?:string;value?:string;verificationId:string;observationId?:string}
export interface ConditionEvaluation {
  conditionId: string; kind: GoalConditionKind; condition: GoalCondition; status: EvaluationStatus
  evidence: EvaluationEvidence; reason: string; issue?:'missing'|'inferred'|'conflict';claims?:EvaluationClaim[]
}
export interface BudgetEvaluation { status: EvaluationStatus; evidence: EvaluationEvidence; reason: string; itemPrice?: Money;issue?:'missing'|'inferred'|'conflict' }
export interface ProductEvaluation {
  goalId: string; goalRevision: number; productId: string; eligibility: EligibilityStatus
  requirements: ConditionEvaluation[]; preferences: ConditionEvaluation[]; exclusions: ConditionEvaluation[]
  budget?: BudgetEvaluation
  costAssessment?: CostAssessment
  /** Compatibility projection for canonical issue derivation; it references the same assessment. */
  counts: { satisfied: number; failed: number; unknown: number }
  evidence?:{observedAt?:string;freshness:EvidenceFreshness}
  readiness?:DecisionReadiness
  readinessReasons?:string[]
  supplier?:SupplierAssessment
}

export type EvaluationProduct = Pick<ProductCluster, 'identity' | 'attributes' | 'options'>
