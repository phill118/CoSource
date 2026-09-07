import {parsePersistedWorkspace} from '../persistence/persisted-workspace-schema'
import type {PersistedWorkspaceEnvelope} from '../persistence/workspace-persistence'

export type ProjectWorkspaceIntegrityReason='missing_project'|'corrupt'|'incompatible'|'identity_mismatch'
export type ProjectWorkspaceBindingResult={ok:true;value:PersistedWorkspaceEnvelope}|{ok:false;reason:ProjectWorkspaceIntegrityReason}

export function validateProjectWorkspaceBinding(projectId:string,value:unknown):ProjectWorkspaceBindingResult{
 if(value===undefined)return{ok:false,reason:'missing_project'}
 const parsed=parsePersistedWorkspace(value)
 if(!parsed.ok)return parsed
 return parsed.value.workspaceId===projectId&&parsed.value.payload.id===projectId?parsed:{ok:false,reason:'identity_mismatch'}
}
