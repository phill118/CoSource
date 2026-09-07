import type {CoSourceApplication} from '../cosource-application'
import {createPersistentApplication,type PersistentApplication} from '../persistence/persistent-application'
import {durableProjection,PERSISTED_WORKSPACE_FORMAT_VERSION,type PersistenceLifecycle,type PersistedWorkspaceEnvelope} from '../persistence/workspace-persistence'
import {validateProjectWorkspaceBinding} from './project-workspace-binding'
import {DEFAULT_PROJECT_NAME,PROJECT_DIRECTORY_FORMAT_VERSION,PROJECT_LIMIT,normalizeProjectName,projectWorkspacePort,type ProjectDirectory,type ProjectMetadata,type ProjectPortfolioPersistencePort} from './project-portfolio'

export type PortfolioLifecycle='restoring'|'ready'|'unavailable'|'recovery_required'|'conflict'
export interface PortfolioSnapshot{status:PortfolioLifecycle;directory?:ProjectDirectory;active?:PersistentApplication;message?:string;operation?:'creating'|'renaming'|'switching'}
export type PortfolioOperationResult={ok:true}|{ok:false;reason:'invalid_name'|'limit'|'busy'|'unsafe_switch'|'conflict'|'storage'|'missing_project';message:string}
export interface ProjectPortfolio{getSnapshot():PortfolioSnapshot;subscribe(listener:()=>void):()=>void;initialize():Promise<void>;retry():Promise<void>;createProject(name:string):Promise<PortfolioOperationResult>;renameActiveProject(name:string):Promise<PortfolioOperationResult>;switchProject(projectId:string):Promise<PortfolioOperationResult>}

const makeEnvelope=(application:CoSourceApplication,now:()=>string):PersistedWorkspaceEnvelope=>{
 const payload=durableProjection(application.getSnapshot())
 return{formatVersion:PERSISTED_WORKSPACE_FORMAT_VERSION,workspaceId:payload.id,durableRevision:0,savedAt:now(),market:payload.market,payload}
}
const safeToLeave=(lifecycle:PersistenceLifecycle)=>lifecycle.status==='ready'

export function createProjectPortfolio(createApplication:()=>CoSourceApplication,repository?:ProjectPortfolioPersistencePort,now=()=>new Date().toISOString()):ProjectPortfolio{
 const listeners=new Set<()=>void>()
 let snapshot:PortfolioSnapshot={status:'restoring'},initialization:Promise<void>|undefined,operation:Promise<PortfolioOperationResult>|undefined
 const publish=(next:PortfolioSnapshot)=>{snapshot=next;listeners.forEach(listener=>listener())}
 const metadata=(application:CoSourceApplication,name:string):ProjectMetadata=>{const timestamp=now();return{id:application.getSnapshot().id,name,createdAt:timestamp,updatedAt:timestamp}}
 const bind=async(directory:ProjectDirectory,restored?:PersistedWorkspaceEnvelope)=>{
  if(restored&&!validateProjectWorkspaceBinding(directory.activeProjectId,restored).ok){publish({status:'recovery_required',directory,message:'The active project identity does not match its saved workspace.'});return false}
  let initial=restored,consumed=false
  const delegated=projectWorkspacePort(repository!,directory.activeProjectId)
  const port={load:async()=>{if(!consumed&&initial!==undefined){consumed=true;const value=initial;initial=undefined;return value}return delegated.load()},compareAndSave:delegated.compareAndSave}
  const application=createApplication(),controller=createPersistentApplication(application,port,now)
  await controller.initialize()
  const lifecycle=controller.getPersistenceSnapshot()
  if(lifecycle.status!=='ready'){controller.dispose();publish({status:lifecycle.status==='conflict'?'conflict':'recovery_required',directory,message:'The selected project could not be restored safely.'});return false}
  publish({status:'ready',directory,active:controller});return true
 }
 const unavailable=()=>{
  const application=createApplication(),lifecycle={status:'unavailable' as const,retryCapability:'unsupported' as const,message:'Local persistence is unavailable in this browser; saved projects require local browser storage and this workspace is memory-only.'}
  const active:PersistentApplication={application,getPersistenceSnapshot:()=>lifecycle,subscribePersistence:()=>()=>{},initialize:async()=>{},retry:async()=>{},dispose:()=>{}}
  publish({status:'unavailable',active,message:lifecycle.message})
 }
 const initialize=()=>initialization??=(async()=>{
  if(!repository){unavailable();return}
  publish({status:'restoring'})
  try{
   let result=await repository.loadPortfolio()
   if(result.status==='missing'){
    const application=createApplication(),item=metadata(application,DEFAULT_PROJECT_NAME)
    const directory:ProjectDirectory={formatVersion:PROJECT_DIRECTORY_FORMAT_VERSION,directoryRevision:0,activeProjectId:item.id,projects:[item]}
    result=await repository.initializePortfolio(directory,makeEnvelope(application,now))
   }
   if(result.status==='ready'){await bind(result.directory,result.workspace);return}
   publish({status:'recovery_required',message:result.status==='missing'?'The saved project directory could not be initialized.':result.message})
  }catch{publish({status:'unavailable',message:'Local project storage is temporarily unavailable.'})}
 })()
 const retry=async()=>{if(snapshot.status==='unavailable'||snapshot.status==='recovery_required'){initialization=undefined;await initialize()}}
 const run=(work:()=>Promise<PortfolioOperationResult>)=>operation??=(async()=>{try{return await work()}finally{operation=undefined}})()
 const activeReady=():{active:PersistentApplication;directory:ProjectDirectory}|undefined=>snapshot.status==='ready'&&snapshot.active&&snapshot.directory?{active:snapshot.active,directory:snapshot.directory}:undefined
 const createProject=(name:string)=>run(async()=>{
  const normalized=normalizeProjectName(name)
  if(!normalized)return{ok:false,reason:'invalid_name',message:'Project names must be between 1 and 100 characters.'}
  const current=activeReady()
  if(!current||!safeToLeave(current.active.getPersistenceSnapshot()))return{ok:false,reason:'unsafe_switch',message:'Wait until the current project is safely saved.'}
  if(current.directory.projects.length>=PROJECT_LIMIT)return{ok:false,reason:'limit',message:`The local limit of ${PROJECT_LIMIT} projects has been reached.`}
  const application=createApplication(),item=metadata(application,normalized)
  const next:ProjectDirectory={...current.directory,directoryRevision:current.directory.directoryRevision+1,activeProjectId:item.id,projects:[...current.directory.projects,item]}
  publish({...snapshot,operation:'creating'})
  try{
   const created=makeEnvelope(application,now),result=await repository!.createProject(next,current.directory.directoryRevision,created)
   if(!result.ok){publish({status:'conflict',directory:current.directory,active:current.active,message:'The saved project list changed elsewhere. Reload to reconcile it safely.'});return{ok:false,reason:'conflict',message:'Another window changed the saved project list.'}}
   const previous=current.active,ready=await bind(result.directory,created)
   if(ready)previous.dispose()
   return ready?{ok:true}:{ok:false,reason:'storage',message:'The new project could not be opened.'}
  }catch{publish({...snapshot,status:'ready',operation:undefined,message:'The project could not be created.'});return{ok:false,reason:'storage',message:'The project could not be created.'}}
 })
 const renameActiveProject=(name:string)=>run(async()=>{
  const normalized=normalizeProjectName(name)
  if(!normalized)return{ok:false,reason:'invalid_name',message:'Enter a non-empty project name of at most 100 characters.'}
  const current=activeReady()
  if(!current)return{ok:false,reason:'busy',message:'Projects are not ready.'}
  const projects=current.directory.projects.map(project=>project.id===current.directory.activeProjectId?{...project,name:normalized,updatedAt:now()}:project)
  const next:ProjectDirectory={...current.directory,directoryRevision:current.directory.directoryRevision+1,projects}
  publish({...snapshot,operation:'renaming'})
  try{
   const result=await repository!.compareAndSaveDirectory(next,current.directory.directoryRevision)
   if(!result.ok){publish({status:'conflict',directory:current.directory,active:current.active,message:'The saved project list changed elsewhere. Reload to reconcile it safely.'});return{ok:false,reason:'conflict',message:'Another window renamed or switched a project.'}}
   publish({status:'ready',directory:result.directory,active:current.active});return{ok:true}
  }catch{publish({...snapshot,operation:undefined,message:'The project name was not changed.'});return{ok:false,reason:'storage',message:'The project name was not changed.'}}
 })
 const switchProject=(projectId:string)=>run(async()=>{
  const current=activeReady()
  if(!current)return{ok:false,reason:'busy',message:'Projects are not ready.'}
  if(projectId===current.directory.activeProjectId)return{ok:true}
  if(!current.directory.projects.some(item=>item.id===projectId))return{ok:false,reason:'missing_project',message:'That project is not in the saved project list.'}
  if(!safeToLeave(current.active.getPersistenceSnapshot()))return{ok:false,reason:'unsafe_switch',message:'The current project has unresolved local changes and cannot be left safely.'}
  const next:ProjectDirectory={...current.directory,directoryRevision:current.directory.directoryRevision+1,activeProjectId:projectId}
  publish({...snapshot,operation:'switching'})
  try{
   const raw=await repository!.loadProject(projectId),parsed=validateProjectWorkspaceBinding(projectId,raw)
   if(!parsed.ok){publish({status:'ready',directory:current.directory,active:current.active,message:'The selected saved project is missing, invalid, or belongs to another project.'});return{ok:false,reason:'missing_project',message:'The selected saved project is unavailable.'}}
   const saved=await repository!.compareAndSaveDirectory(next,current.directory.directoryRevision)
   if(!saved.ok){publish({status:'conflict',directory:current.directory,active:current.active,message:'The saved project list changed elsewhere. Reload to reconcile it safely.'});return{ok:false,reason:'conflict',message:'Another window changed the active project.'}}
   const previous=current.active,ready=await bind(saved.directory,parsed.value)
   if(ready)previous.dispose()
   return ready?{ok:true}:{ok:false,reason:'storage',message:'The selected project could not be restored.'}
  }catch{publish({...snapshot,status:'ready',operation:undefined,message:'The selected project could not be opened.'});return{ok:false,reason:'storage',message:'The selected project could not be opened.'}}
 })
 return{getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},initialize,retry,createProject,renameActiveProject,switchProject}
}
