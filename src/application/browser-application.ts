import { catalogClient } from '../commerce/client/catalog-client'
import { createCoSourceApplication } from './cosource-application'
import {createProjectPortfolio,type ProjectPortfolio} from './portfolio/project-portfolio-controller'
import {createIndexedDBProjectPortfolioPersistence} from '../browser/indexeddb-workspace-persistence'

const applicationFactory=()=>createCoSourceApplication({catalog:{search:catalogClient.search,product:input=>catalogClient.product({product:input.identity,country:input.market.country,currency:input.market.currency,selectedOptions:input.selectedOptions})},market:{country:'GB',currency:'GBP',language:'en'}})
export const createBrowserApplication=():ProjectPortfolio=>createProjectPortfolio(applicationFactory,typeof indexedDB==='undefined'?undefined:createIndexedDBProjectPortfolioPersistence(indexedDB))
