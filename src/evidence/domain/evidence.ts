export type EvidenceFreshness = 'current' | 'stale' | 'unknown' | 'not_constrained'
export interface EvidenceFreshnessPolicy { maximumAgeDays?:number;requiredAsOf?:string }
export type DecisionReadiness='blocked_by_known_failure'|'blocked_by_known_conflict'|'insufficient_evidence'|'verification_required'|'ready_on_current_evidence'
export function assessEvidenceFreshness(observedAt:string|undefined,policy:EvidenceFreshnessPolicy|undefined,now:string):EvidenceFreshness {
 if(!policy)return'not_constrained'
 const observed=observedAt&&Date.parse(observedAt),current=Date.parse(now)
 if(!observed||!Number.isFinite(observed)||!Number.isFinite(current)||observed>current)return'unknown'
 if(policy.requiredAsOf!==undefined){const required=Date.parse(policy.requiredAsOf);if(!Number.isFinite(required)||observed<required)return'stale'}
 if(policy.maximumAgeDays!==undefined&&current-observed>policy.maximumAgeDays*86_400_000)return'stale'
 return'current'
}
