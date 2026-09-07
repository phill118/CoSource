import { catalogClient } from '../commerce/client/catalog-client'
import { createCoSourceApplication } from './cosource-application'
import {createPersistentApplication,type PersistentApplication} from './persistence/persistent-application'
import {createIndexedDBWorkspacePersistence} from '../browser/indexeddb-workspace-persistence'

export const createBrowserApplication=():PersistentApplication=>{const application=createCoSourceApplication({catalog:{search:catalogClient.search,product:input=>catalogClient.product({product:input.identity,country:input.market.country,currency:input.market.currency,selectedOptions:input.selectedOptions})},market:{country:'GB',currency:'GBP',language:'en'}});if(typeof indexedDB==='undefined'){const lifecycle={status:'unavailable' as const,retryCapability:'unsupported' as const,message:'Local persistence is unavailable in this browser; this workspace is memory-only.'};return{application,getPersistenceSnapshot:()=>lifecycle,subscribePersistence:()=>()=>{},initialize:async()=>{},retry:async()=>{}}}return createPersistentApplication(application,createIndexedDBWorkspacePersistence(indexedDB))}
