import type { Money, ProviderIdentity } from '../../commerce/domain/commerce'
import type {DecisionReadiness} from '../../evidence/domain/evidence'
import type {CostAssessment} from '../../costing/domain/cost'
export type PlanStatus='draft'|'incomplete'|'has_unverified_requirements'|'has_known_conflicts'|'ready_on_known_evidence'
export interface PlanLine { id:string; product:ProviderIdentity; productTitle:string; selectedOffer?:ProviderIdentity; offerSelection?:'explicit_human'|'sole_offer'; quantity?:number; unitSemantics:'single_item'|'unknown' }
export interface PurchasePlan { id:string; revision:number; goalId:string; goalRevision:number; lines:PlanLine[] }
export type KnownSubtotal=Money
export interface PlanBudgetEvaluation { status:'satisfied'|'failed'|'unknown'; reason:string; evidence:{kind:'cosource_derived'|'unknown'}; goalBudget:Money; comparableSubtotal?:Money }
export interface PlanEvaluation { status:PlanStatus; stale:boolean; mandatoryFailures:number; exclusionViolations:number; mandatoryUnknowns:number; preferencesSatisfied:number; preferencesUnknown:number; merchantCount:number; currencies:string[]; knownSubtotals:KnownSubtotal[]; unresolvedCosts:string[]; budget?:PlanBudgetEvaluation;costAssessment?:CostAssessment;readiness?:DecisionReadiness;readinessReasons?:string[] }
export const PLAN_QUANTITY_MAX=100_000
export function createPurchasePlan(id:string,goalId:string,goalRevision:number):PurchasePlan{return{id,revision:0,goalId,goalRevision,lines:[]}}
function assertUnique(lines:PlanLine[]){if(lines.some(x=>!x.id)||new Set(lines.map(x=>x.id)).size!==lines.length)throw new TypeError('Plan line identities must be unique and non-empty');if(lines.some(x=>x.quantity!==undefined&&(!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>PLAN_QUANTITY_MAX)))throw new RangeError(`Plan quantities must be integers from 1 to ${PLAN_QUANTITY_MAX}`);if(lines.some(x=>Boolean(x.selectedOffer)!==Boolean(x.offerSelection)))throw new TypeError('Offer identity and selection basis must be stored together')}
export function revisePurchasePlan(plan:PurchasePlan,lines:PlanLine[]):PurchasePlan{assertUnique(lines);return{...plan,revision:plan.revision+1,lines}}
