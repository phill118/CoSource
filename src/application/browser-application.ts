import { catalogClient } from '../commerce/client/catalog-client'
import { createCoSourceApplication } from './cosource-application'

export const createBrowserApplication=()=>createCoSourceApplication({catalog:{search:catalogClient.search,product:input=>catalogClient.product({product:input.identity,country:input.market.country,currency:input.market.currency,selectedOptions:input.selectedOptions})},market:{country:'GB',currency:'GBP',language:'en'}})
