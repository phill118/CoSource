import {parsePersistedWorkspace} from './persisted-workspace-schema'
import type {PersistedWorkspaceEnvelope,SaveWorkspaceResult,WorkspacePersistencePort} from './workspace-persistence'

export class MemoryWorkspacePersistence implements WorkspacePersistencePort{
 record:unknown|undefined
 writes:PersistedWorkspaceEnvelope[]=[]
 unavailable=false
 constructor(record?:unknown){this.record=structuredClone(record)}
 async load(){if(this.unavailable)throw new Error('unavailable');return structuredClone(this.record)}
 async compareAndSave(record:PersistedWorkspaceEnvelope,expectedRevision:number|undefined):Promise<SaveWorkspaceResult>{if(this.unavailable)throw new Error('unavailable');if(this.record===undefined){if(expectedRevision!==undefined)return{ok:false,reason:'conflict',currentRevision:0}}else{const current=parsePersistedWorkspace(this.record);if(!current.ok)throw new Error('stored workspace record is invalid');if(current.value.durableRevision!==expectedRevision)return{ok:false,reason:'conflict',currentRevision:current.value.durableRevision}}const saved=structuredClone(record);this.record=saved;this.writes.push(structuredClone(saved));return{ok:true,record:structuredClone(saved)}}
}
