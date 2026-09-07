import type {CoSourceApplication} from '../cosource-application'
import {parsePersistedWorkspace} from './persisted-workspace-schema'
import {durableFingerprint,durableProjection,PERSISTED_WORKSPACE_FORMAT_VERSION,type PersistenceLifecycle,type PersistedWorkspaceEnvelope,type WorkspacePersistencePort} from './workspace-persistence'

export interface PersistentApplication{
 application:CoSourceApplication
 getPersistenceSnapshot():PersistenceLifecycle
 subscribePersistence(listener:()=>void):()=>void
 initialize():Promise<void>
 retry():Promise<void>
 dispose():void
}

export function createPersistentApplication(application:CoSourceApplication,repository:WorkspacePersistencePort,now=()=>new Date().toISOString()):PersistentApplication{
 let lifecycle:PersistenceLifecycle={status:'restoring'},initialization:Promise<void>|undefined,retryOperation:Promise<void>|undefined,unsubscribe:(()=>void)|undefined,lastFingerprint='',recoveryFingerprint:string|undefined,persistedRevision:number|undefined,durableRevision=0,pending=false,saving=false,disabled=true
 const listeners=new Set<()=>void>(),publish=(next:PersistenceLifecycle)=>{lifecycle=next;listeners.forEach(listener=>listener())}
 const currentFingerprint=()=>durableFingerprint(durableProjection(application.getSnapshot()))
 const envelope=():PersistedWorkspaceEnvelope=>{const payload=durableProjection(application.getSnapshot());return{formatVersion:PERSISTED_WORKSPACE_FORMAT_VERSION,workspaceId:payload.id,durableRevision,savedAt:now(),market:payload.market,payload}}
 const saveLatest=async()=>{if(saving||disabled)return;saving=true;try{while(pending&&!disabled){pending=false;const target=envelope(),expected=persistedRevision;publish({status:'saving',durableRevision:target.durableRevision,...(persistedRevision===undefined?{}:{lastSavedRevision:persistedRevision}),...('lastSavedAt'in lifecycle&&lifecycle.lastSavedAt?{lastSavedAt:lifecycle.lastSavedAt}:{})});let result;try{result=await repository.compareAndSave(target,expected)}catch{disabled=true;publish({status:'save_error',durableRevision:target.durableRevision,message:'Changes could not be saved locally.',...(persistedRevision===undefined?{}:{lastSavedRevision:persistedRevision})});return}if(!result.ok){disabled=true;publish({status:'conflict',durableRevision:target.durableRevision,storedRevision:result.currentRevision,message:'Another tab saved a newer workspace. Your in-memory work was preserved.'});return}persistedRevision=target.durableRevision;publish({status:'ready',lastSavedRevision:target.durableRevision,lastSavedAt:target.savedAt})}}finally{saving=false}}
 const changed=()=>{if(disabled)return;const fingerprint=currentFingerprint();if(fingerprint===lastFingerprint)return;lastFingerprint=fingerprint;durableRevision++;pending=true;void saveLatest()}
 const startWatching=()=>{unsubscribe?.();lastFingerprint=currentFingerprint();unsubscribe=application.subscribe(changed);disabled=false}
 const loadFromBoundary=async(boundaryFingerprint:string)=>{publish({status:'restoring'});let raw:unknown|undefined;try{raw=await repository.load()}catch{recoveryFingerprint??=boundaryFingerprint;disabled=true;publish({status:'unavailable',retryCapability:'supported',message:'Local persistence is temporarily unavailable; this workspace is memory-only.'});return}
  const memoryChanged=currentFingerprint()!==boundaryFingerprint
  if(raw!==undefined){const parsed=parsePersistedWorkspace(raw);if(!parsed.ok){recoveryFingerprint??=boundaryFingerprint;disabled=true;publish({status:'recovery_required',reason:parsed.reason,access:memoryChanged?'memory_preserved':'gated',message:memoryChanged?'Your current workspace is preserved in memory, but the saved workspace could not be safely validated. Local saving and agent tools remain disabled.':parsed.reason==='incompatible'?'The saved workspace uses an unsupported format.':'The saved workspace could not be safely validated.'});return}if(memoryChanged){disabled=true;publish({status:'conflict',durableRevision,storedRevision:parsed.value.durableRevision,message:'Local storage recovered with a different workspace. Your in-memory work was preserved.'});return}application.restoreWorkspace(parsed.value.payload);persistedRevision=parsed.value.durableRevision;durableRevision=parsed.value.durableRevision;recoveryFingerprint=undefined;startWatching();publish({status:'ready',lastSavedRevision:parsed.value.durableRevision,lastSavedAt:parsed.value.savedAt});return}
  recoveryFingerprint=undefined;startWatching();pending=true;await saveLatest()
 }
 const initialize=()=>initialization??=loadFromBoundary(currentFingerprint())
 const retry=()=>retryOperation??=(async()=>{try{if(lifecycle.status==='save_error'){disabled=false;const fingerprint=currentFingerprint();if(fingerprint!==lastFingerprint){lastFingerprint=fingerprint;durableRevision++}pending=true;await saveLatest();return}if(lifecycle.status==='unavailable'||lifecycle.status==='recovery_required'){await loadFromBoundary(recoveryFingerprint??currentFingerprint())}}finally{retryOperation=undefined}})()
 const dispose=()=>{disabled=true;pending=false;unsubscribe?.();unsubscribe=undefined;listeners.clear()}
 return{application,getPersistenceSnapshot:()=>lifecycle,subscribePersistence:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},initialize,retry,dispose}
}
