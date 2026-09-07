import type {SaveWorkspaceResult,WorkspacePersistencePort} from '../application/persistence/workspace-persistence'
import {parsePersistedWorkspace} from '../application/persistence/persisted-workspace-schema'
import {parseProjectDirectory} from '../application/portfolio/project-directory-schema'
import {validateProjectWorkspaceBinding} from '../application/portfolio/project-workspace-binding'
import type {CreateProjectResult,DirectorySaveResult,PortfolioLoadResult,ProjectPortfolioPersistencePort} from '../application/portfolio/project-portfolio'

export const COSOURCE_WORKSPACE_DATABASE='cosource-local-workspace'
export const COSOURCE_WORKSPACE_DATABASE_VERSION=2
export const COSOURCE_WORKSPACE_STORE='workspaces'
export const COSOURCE_WORKSPACE_KEY='current'
export const COSOURCE_PROJECT_DIRECTORY_STORE='project-directory'
export const COSOURCE_PROJECT_DIRECTORY_KEY='directory'
const projectKey=(id:string)=>`project:${id}`
const requestResult=<T>(request:IDBRequest<T>):Promise<T>=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('storage request failed'))})
const transactionDone=(transaction:IDBTransaction):Promise<void>=>new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(new Error('storage transaction aborted'));transaction.onerror=()=>reject(new Error('storage transaction failed'))})

async function openDatabase(factory:IDBFactory):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{let settled=false;const request=factory.open(COSOURCE_WORKSPACE_DATABASE,COSOURCE_WORKSPACE_DATABASE_VERSION),fail=(message:string)=>{if(settled)return;settled=true;reject(new Error(message))};request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(COSOURCE_WORKSPACE_STORE))database.createObjectStore(COSOURCE_WORKSPACE_STORE);if(!database.objectStoreNames.contains(COSOURCE_PROJECT_DIRECTORY_STORE))database.createObjectStore(COSOURCE_PROJECT_DIRECTORY_STORE)};request.onsuccess=()=>{if(settled){request.result.close();return}settled=true;resolve(request.result)};request.onerror=()=>fail('storage unavailable');request.onblocked=()=>fail('storage blocked')})}
function workspaceRevision(value:unknown){if(value===undefined)return undefined;const parsed=parsePersistedWorkspace(value);if(!parsed.ok)throw new Error('stored workspace record is invalid');return parsed.value.durableRevision}
function directoryRevision(value:unknown){if(value===undefined)return undefined;const parsed=parseProjectDirectory(value);if(!parsed.ok)throw new Error('stored project directory is invalid');return parsed.value.directoryRevision}
const recovery=(reason:'missing_project'|'corrupt'|'incompatible'|'identity_mismatch',projectId:string):PortfolioLoadResult=>({status:'recovery_required',reason,projectId,message:`Saved project ${projectId} failed integrity validation.`})

export function createIndexedDBProjectPortfolioPersistence(factory:IDBFactory):ProjectPortfolioPersistencePort{
 const withDatabase=async<T>(work:(database:IDBDatabase)=>Promise<T>)=>{const database=await openDatabase(factory);try{return await work(database)}finally{database.close()}}
 const readPortfolio=async(directoryRaw:unknown,workspaces:IDBObjectStore):Promise<PortfolioLoadResult>=>{
  if(directoryRaw===undefined)return{status:'missing'}
  const directory=parseProjectDirectory(directoryRaw)
  if(!directory.ok)return{status:'recovery_required',reason:directory.reason,message:'The saved project directory could not be safely validated.'}
  let active
  for(const project of directory.value.projects){
   const binding=validateProjectWorkspaceBinding(project.id,await requestResult(workspaces.get(projectKey(project.id))))
   if(!binding.ok)return recovery(binding.reason,project.id)
   if(project.id===directory.value.activeProjectId)active=binding.value
  }
  return{status:'ready',directory:directory.value,workspace:active!}
 }
 return{
  loadPortfolio:()=>withDatabase(async database=>{const tx=database.transaction([COSOURCE_PROJECT_DIRECTORY_STORE,COSOURCE_WORKSPACE_STORE],'readonly'),result=await readPortfolio(await requestResult(tx.objectStore(COSOURCE_PROJECT_DIRECTORY_STORE).get(COSOURCE_PROJECT_DIRECTORY_KEY)),tx.objectStore(COSOURCE_WORKSPACE_STORE));await transactionDone(tx);return result}),
  initializePortfolio:(freshDirectory,freshWorkspace)=>withDatabase(async database=>{
   const proposed=parseProjectDirectory(freshDirectory),freshBinding=validateProjectWorkspaceBinding(freshDirectory.activeProjectId,freshWorkspace)
   if(!proposed.ok||!freshBinding.ok)throw new Error('invalid portfolio initialization')
   const tx=database.transaction([COSOURCE_PROJECT_DIRECTORY_STORE,COSOURCE_WORKSPACE_STORE],'readwrite'),directories=tx.objectStore(COSOURCE_PROJECT_DIRECTORY_STORE),workspaces=tx.objectStore(COSOURCE_WORKSPACE_STORE)
   try{
    const existing=await requestResult(directories.get(COSOURCE_PROJECT_DIRECTORY_KEY))
    if(existing!==undefined){const result=await readPortfolio(existing,workspaces);tx.abort();return result}
    const legacyRaw=await requestResult(workspaces.get(COSOURCE_WORKSPACE_KEY))
    let directory=proposed.value,workspace=freshBinding.value
    if(legacyRaw!==undefined){
     const legacy=parsePersistedWorkspace(legacyRaw)
     if(!legacy.ok){tx.abort();return{status:'recovery_required',reason:legacy.reason,message:'The legacy saved workspace could not be safely migrated and remains untouched.'}}
     const project={...directory.projects[0]!,id:legacy.value.workspaceId}
     directory={...directory,activeProjectId:project.id,projects:[project]};workspace=legacy.value
     if(!parseProjectDirectory(directory).ok||!validateProjectWorkspaceBinding(project.id,workspace).ok){tx.abort();return recovery('identity_mismatch',project.id)}
    }
    workspaces.put(workspace,projectKey(directory.activeProjectId));directories.put(directory,COSOURCE_PROJECT_DIRECTORY_KEY)
    await transactionDone(tx);return{status:'ready',directory,workspace}
   }catch(error){try{tx.abort()}catch{/* complete */}throw error}
  }),
  loadProject:id=>withDatabase(async database=>{const tx=database.transaction(COSOURCE_WORKSPACE_STORE,'readonly'),value=await requestResult(tx.objectStore(COSOURCE_WORKSPACE_STORE).get(projectKey(id)));await transactionDone(tx);return value}),
  createProject:(directory,expected,workspace)=>withDatabase(async database=>{
   const next=parseProjectDirectory(directory),binding=validateProjectWorkspaceBinding(directory.activeProjectId,workspace)
   if(!next.ok||!binding.ok||directory.directoryRevision!==expected+1||!directory.projects.some(item=>item.id===workspace.workspaceId))throw new Error('invalid project creation')
   const tx=database.transaction([COSOURCE_PROJECT_DIRECTORY_STORE,COSOURCE_WORKSPACE_STORE],'readwrite'),directories=tx.objectStore(COSOURCE_PROJECT_DIRECTORY_STORE),workspaces=tx.objectStore(COSOURCE_WORKSPACE_STORE)
   try{const raw=await requestResult(directories.get(COSOURCE_PROJECT_DIRECTORY_KEY)),current=parseProjectDirectory(raw);if(!current.ok)throw new Error('invalid stored directory');if(current.value.directoryRevision!==expected){tx.abort();return{ok:false,reason:'conflict',currentRevision:current.value.directoryRevision} as CreateProjectResult}if(current.value.projects.some(item=>item.id===workspace.workspaceId)||await requestResult(workspaces.get(projectKey(workspace.workspaceId)))!==undefined)throw new Error('project already exists');workspaces.put(binding.value,projectKey(workspace.workspaceId));directories.put(next.value,COSOURCE_PROJECT_DIRECTORY_KEY);await transactionDone(tx);return{ok:true,directory:next.value} as CreateProjectResult}catch(error){try{tx.abort()}catch{/* complete */}throw error}
  }),
  compareAndSaveDirectory:(directory,expected)=>withDatabase(async database=>{
   const next=parseProjectDirectory(directory);if(!next.ok||directory.directoryRevision!==expected+1)throw new Error('invalid directory write')
   const tx=database.transaction(COSOURCE_PROJECT_DIRECTORY_STORE,'readwrite'),store=tx.objectStore(COSOURCE_PROJECT_DIRECTORY_STORE)
   try{const revision=directoryRevision(await requestResult(store.get(COSOURCE_PROJECT_DIRECTORY_KEY)));if(revision!==expected){tx.abort();return{ok:false,reason:'conflict',currentRevision:revision??0} as DirectorySaveResult}store.put(next.value,COSOURCE_PROJECT_DIRECTORY_KEY);await transactionDone(tx);return{ok:true,directory:next.value} as DirectorySaveResult}catch(error){try{tx.abort()}catch{/* complete */}throw error}
  }),
  compareAndSaveProject:(id,record,expected)=>withDatabase(async database=>{
   const incoming=validateProjectWorkspaceBinding(id,record);if(!incoming.ok)throw new Error('invalid project binding')
   const tx=database.transaction(COSOURCE_WORKSPACE_STORE,'readwrite'),store=tx.objectStore(COSOURCE_WORKSPACE_STORE)
   try{const currentRaw=await requestResult(store.get(projectKey(id))),current=currentRaw===undefined?undefined:validateProjectWorkspaceBinding(id,currentRaw);if(current&&!current.ok)throw new Error('invalid stored project');const revision=current?.ok?current.value.durableRevision:undefined;if(revision!==expected){tx.abort();return{ok:false,reason:'conflict',currentRevision:revision??0} as SaveWorkspaceResult}store.put(incoming.value,projectKey(id));await transactionDone(tx);return{ok:true,record:incoming.value} as SaveWorkspaceResult}catch(error){try{tx.abort()}catch{/* complete */}throw error}
  })
 }
}

/** R3 compatibility boundary for the retained legacy singleton tests. */
export function createIndexedDBWorkspacePersistence(factory:IDBFactory):WorkspacePersistencePort{
 const withDatabase=async<T>(work:(database:IDBDatabase)=>Promise<T>)=>{const database=await openDatabase(factory);try{return await work(database)}finally{database.close()}}
 return{
  load:()=>withDatabase(async database=>{const tx=database.transaction(COSOURCE_WORKSPACE_STORE,'readonly'),value=await requestResult(tx.objectStore(COSOURCE_WORKSPACE_STORE).get(COSOURCE_WORKSPACE_KEY));await transactionDone(tx);return value}),
  compareAndSave:(record,expected)=>withDatabase(async database=>{const parsed=parsePersistedWorkspace(record);if(!parsed.ok)throw new Error('invalid workspace');const tx=database.transaction(COSOURCE_WORKSPACE_STORE,'readwrite'),store=tx.objectStore(COSOURCE_WORKSPACE_STORE);try{const revision=workspaceRevision(await requestResult(store.get(COSOURCE_WORKSPACE_KEY)));if(revision!==expected){tx.abort();return{ok:false,reason:'conflict',currentRevision:revision??0}}store.put(parsed.value,COSOURCE_WORKSPACE_KEY);await transactionDone(tx);return{ok:true,record:parsed.value}}catch(error){try{tx.abort()}catch{/* complete */}throw error}})
 }
}
