import type {CoSourceSessionState,MarketContext} from '../cosource-application'
import type {PurchaseGoal,PurchaseGoalDraft} from '../../goals/domain/purchase-goal'
import type {ProductEvidenceEntry} from '../../evidence/product-evidence-ledger'
import type {ProviderIdentity} from '../../commerce/domain/commerce'
import type {PurchasePlan} from '../../planning/domain/purchase-plan'
import type {GoalInterpretationProposal} from '../../goals/domain/goal-interpretation-proposal'
import type {PlanChangeProposal} from '../../proposals/domain/plan-change-proposal'

export const PERSISTED_WORKSPACE_FORMAT_VERSION=1 as const
export const PERSISTED_ACTIVITY_LIMIT=20
export const PERSISTED_PROPOSAL_LIMIT=20

export interface DurableWorkspaceState{
 id:string;revision:number;market:MarketContext;goalDraft:PurchaseGoalDraft;activeGoal?:PurchaseGoal
 retainedEvidence:ProductEvidenceEntry[];comparisonIds:ProviderIdentity[];plan:PurchasePlan
 goalInterpretationProposals:GoalInterpretationProposal[];proposals:PlanChangeProposal[];activities:CoSourceSessionState['activities']
}
export interface PersistedWorkspaceEnvelope{formatVersion:typeof PERSISTED_WORKSPACE_FORMAT_VERSION;workspaceId:string;durableRevision:number;savedAt:string;market:MarketContext;payload:DurableWorkspaceState}
export type SaveWorkspaceResult={ok:true;record:PersistedWorkspaceEnvelope}|{ok:false;reason:'conflict';currentRevision:number}
export interface WorkspacePersistencePort{load():Promise<unknown|undefined>;compareAndSave(record:PersistedWorkspaceEnvelope,expectedRevision:number|undefined):Promise<SaveWorkspaceResult>}

export type PersistenceLifecycle=
 |{status:'restoring'}
 |{status:'ready';lastSavedRevision?:number;lastSavedAt?:string}
 |{status:'saving';durableRevision:number;lastSavedRevision?:number;lastSavedAt?:string}
 |{status:'save_error';durableRevision:number;message:string;lastSavedRevision?:number;lastSavedAt?:string}
 |{status:'recovery_required';reason:'corrupt'|'incompatible';access:'gated'|'memory_preserved';message:string}
 |{status:'unavailable';retryCapability:'supported'|'unsupported';message:string}
 |{status:'conflict';durableRevision:number;storedRevision:number;message:string}

export function durableProjection(state:CoSourceSessionState):DurableWorkspaceState{return{id:state.id,revision:state.revision,market:state.market,goalDraft:state.goalDraft,activeGoal:state.activeGoal,retainedEvidence:state.retainedEvidence,comparisonIds:state.comparisonIds,plan:state.plan,goalInterpretationProposals:state.goalInterpretationProposals,proposals:state.proposals,activities:state.activities}}
export function durableFingerprint(state:DurableWorkspaceState){return JSON.stringify({...state,revision:0})}
