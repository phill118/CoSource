export type EvidenceFreshness = 'current' | 'stale' | 'unknown' | 'not_constrained'
export interface EvidenceFreshnessPolicy { maximumAgeDays?:number;requiredAsOf?:string }
export type DecisionReadiness='blocked_by_known_failure'|'blocked_by_known_conflict'|'insufficient_evidence'|'verification_required'|'ready_on_current_evidence'
const readinessPrecedence:Record<DecisionReadiness,number>={blocked_by_known_failure:5,blocked_by_known_conflict:4,insufficient_evidence:3,verification_required:2,ready_on_current_evidence:1}
export function composeDecisionReadiness(...values:Array<DecisionReadiness|undefined>):DecisionReadiness{return values.filter((value):value is DecisionReadiness=>Boolean(value)).reduce((current,value)=>readinessPrecedence[value]>readinessPrecedence[current]?value:current,'ready_on_current_evidence')}
export function assessEvidenceFreshness(observedAt:string|undefined,policy:EvidenceFreshnessPolicy|undefined,now:string):EvidenceFreshness {
 if(!policy)return'not_constrained'
 const observed=observedAt&&Date.parse(observedAt),current=Date.parse(now)
 if(!observed||!Number.isFinite(observed)||!Number.isFinite(current)||observed>current)return'unknown'
 if(policy.requiredAsOf!==undefined){const required=Date.parse(policy.requiredAsOf);if(!Number.isFinite(required)||observed<required)return'stale'}
 if(policy.maximumAgeDays!==undefined&&current-observed>policy.maximumAgeDays*86_400_000)return'stale'
 return'current'
}
import {z} from 'zod'

export const evidenceStrengthSchema=z.enum(['source_explicit','cosource_derived','source_inferred','unknown'])
export type EvidenceStrength=z.infer<typeof evidenceStrengthSchema>
export const evidenceReferenceSchema=z.object({strength:evidenceStrengthSchema,source:z.string().trim().min(1).max(100)}).strict()
export type EvidenceReference=z.infer<typeof evidenceReferenceSchema>
export const isDecisionGradeEvidence=(strength:EvidenceStrength)=>strength==='source_explicit'||strength==='cosource_derived'
