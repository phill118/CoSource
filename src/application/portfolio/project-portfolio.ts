import type {PersistedWorkspaceEnvelope,SaveWorkspaceResult,WorkspacePersistencePort} from '../persistence/workspace-persistence'
import type {ProjectWorkspaceIntegrityReason} from './project-workspace-binding'

export const PROJECT_DIRECTORY_FORMAT_VERSION=1 as const
export const PROJECT_LIMIT=50
export const PROJECT_NAME_LIMIT=100
export const DEFAULT_PROJECT_NAME='Untitled purchasing project'

export interface ProjectMetadata{id:string;name:string;createdAt:string;updatedAt:string}
export interface ProjectDirectory{formatVersion:typeof PROJECT_DIRECTORY_FORMAT_VERSION;directoryRevision:number;activeProjectId:string;projects:ProjectMetadata[]}
export type PortfolioLoadResult=
 |{status:'missing'}
 |{status:'ready';directory:ProjectDirectory;workspace:PersistedWorkspaceEnvelope}
 |{status:'recovery_required';reason:ProjectWorkspaceIntegrityReason;projectId?:string;message:string}
export type DirectorySaveResult={ok:true;directory:ProjectDirectory}|{ok:false;reason:'conflict';currentRevision:number}
export type CreateProjectResult={ok:true;directory:ProjectDirectory}|{ok:false;reason:'conflict'|'limit';currentRevision:number}

export interface ProjectPortfolioPersistencePort{
 loadPortfolio():Promise<PortfolioLoadResult>
 initializePortfolio(directory:ProjectDirectory,workspace:PersistedWorkspaceEnvelope):Promise<PortfolioLoadResult>
 loadProject(projectId:string):Promise<unknown|undefined>
 createProject(directory:ProjectDirectory,expectedDirectoryRevision:number,workspace:PersistedWorkspaceEnvelope):Promise<CreateProjectResult>
 compareAndSaveDirectory(directory:ProjectDirectory,expectedRevision:number):Promise<DirectorySaveResult>
 compareAndSaveProject(projectId:string,record:PersistedWorkspaceEnvelope,expectedRevision:number|undefined):Promise<SaveWorkspaceResult>
}

export function normalizeProjectName(value:string){const name=value.trim();return name.length>0&&name.length<=PROJECT_NAME_LIMIT?name:undefined}
export function projectWorkspacePort(repository:ProjectPortfolioPersistencePort,projectId:string):WorkspacePersistencePort{return{load:()=>repository.loadProject(projectId),compareAndSave:(record,expected)=>repository.compareAndSaveProject(projectId,record,expected)}}
