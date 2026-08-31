import type { Money, ProviderIdentity } from '../../commerce/domain/commerce'
import type { ProductEvaluation } from '../../evaluation/domain/product-evaluation'

export type ComparisonOutcome = 'candidate_a_stronger'|'candidate_b_stronger'|'tradeoff'|'insufficient_evidence'|'equivalent_on_known_evidence'
export interface ComparisonMetrics { mandatoryFailures:number; exclusionViolations:number; mandatoryUnknowns:number; mandatorySatisfied:number; preferencesSatisfied:number; preferencesUnknown:number }
export interface EvidenceMetrics { provided:number; inferred:number; derived:number; unknown:number }
export interface ComparisonCandidate { product:ProviderIdentity; title:string; evaluation:ProductEvaluation; metrics:ComparisonMetrics; evidence:EvidenceMetrics; itemPrice?:Money }
export interface ProductComparison { candidateA:ComparisonCandidate; candidateB:ComparisonCandidate; outcome:ComparisonOutcome; reasons:string[]; priceReason:string }
