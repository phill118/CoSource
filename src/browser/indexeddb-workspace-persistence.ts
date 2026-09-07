import type {SaveWorkspaceResult,WorkspacePersistencePort} from '../application/persistence/workspace-persistence'
import {parsePersistedWorkspace} from '../application/persistence/persisted-workspace-schema'

export const COSOURCE_WORKSPACE_DATABASE='cosource-local-workspace'
export const COSOURCE_WORKSPACE_DATABASE_VERSION=1
export const COSOURCE_WORKSPACE_STORE='workspaces'
export const COSOURCE_WORKSPACE_KEY='current'

function requestResult<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('storage request failed'))})}
function transactionDone(transaction:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(new Error('storage transaction aborted'));transaction.onerror=()=>reject(new Error('storage transaction failed'))})}
async function openDatabase(factory:IDBFactory):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{let settled=false;const request=factory.open(COSOURCE_WORKSPACE_DATABASE,COSOURCE_WORKSPACE_DATABASE_VERSION),fail=(message:string)=>{if(settled)return;settled=true;reject(new Error(message))};request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(COSOURCE_WORKSPACE_STORE))database.createObjectStore(COSOURCE_WORKSPACE_STORE)};request.onsuccess=()=>{if(settled){request.result.close();return}settled=true;resolve(request.result)};request.onerror=()=>fail('storage unavailable');request.onblocked=()=>fail('storage blocked')})}

function currentRevision(value:unknown):number|undefined{if(value===undefined)return undefined;const parsed=parsePersistedWorkspace(value);if(!parsed.ok)throw new Error('stored workspace record is invalid');return parsed.value.durableRevision}

export function createIndexedDBWorkspacePersistence(factory:IDBFactory):WorkspacePersistencePort{
 const withDatabase=async<T>(work:(database:IDBDatabase)=>Promise<T>)=>{const database=await openDatabase(factory);try{return await work(database)}finally{database.close()}}
 return{
  load:()=>withDatabase(async database=>{const transaction=database.transaction(COSOURCE_WORKSPACE_STORE,'readonly'),result=await requestResult(transaction.objectStore(COSOURCE_WORKSPACE_STORE).get(COSOURCE_WORKSPACE_KEY));await transactionDone(transaction);return result}),
  compareAndSave:(record,expectedRevision)=>withDatabase(async database=>{const transaction=database.transaction(COSOURCE_WORKSPACE_STORE,'readwrite'),store=transaction.objectStore(COSOURCE_WORKSPACE_STORE);try{const current=await requestResult(store.get(COSOURCE_WORKSPACE_KEY)),revision=currentRevision(current);if(revision!==expectedRevision){transaction.abort();return{ok:false,reason:'conflict',currentRevision:revision??0} as SaveWorkspaceResult}store.put(record,COSOURCE_WORKSPACE_KEY);await transactionDone(transaction);return{ok:true,record} as SaveWorkspaceResult}catch(error){try{transaction.abort()}catch{/* already complete */}throw error}}),
 }
}
