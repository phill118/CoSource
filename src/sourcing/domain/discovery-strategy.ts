import type {Money} from '../../commerce/domain/commerce'
import type {GoalConditionKind} from '../../goals/domain/purchase-goal'
export type ProductCondition='new'|'secondhand'
export type TaxonomyAttributeName='Color'|'Size'|'Target gender'
export interface TaxonomyConstraint{name:TaxonomyAttributeName;values:string[]}
export type EvidenceGapResolution='inspect_product'|'refresh_retained_evidence'|'search_for_stronger_evidence'|'requires_merchant_verification'|'unsupported_by_provider'
export type EvidenceGapType='missing'|'inferred'|'stale'|'conflict'|'unsupported'
export interface EvidenceGap{subject?:{provider:string;id:string};goalConditionId?:string;description:string;reason:string;resolution:EvidenceGapResolution;relevance:'mandatory'|'preference';gapType?:EvidenceGapType}
export interface DiscoveryStrategy{goalId:string;goalRevision:number;query:string;humanIntent:string;market:{country:string;currency:string};constraints:{available:true;shipsToCountry:string;maximumPrice?:Money;condition?:ProductCondition;attributes:TaxonomyConstraint[]};unprojectable:string[];evidenceGaps:EvidenceGap[];warnings:string[]}
export const relevanceFor=(kind:GoalConditionKind):EvidenceGap['relevance']=>kind==='preference'?'preference':'mandatory'
