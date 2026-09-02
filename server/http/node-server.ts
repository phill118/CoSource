import {resolve} from 'node:path'
import {createCatalogGateway} from '../commerce/gateway'
import {loadServerCommerceConfiguration} from '../commerce/configuration'
import {createCatalogProvider} from '../commerce/provider-factory'
import {createApplicationServer} from './application-server'

const configuration=loadServerCommerceConfiguration()
const gateway=createCatalogGateway(createCatalogProvider(configuration))
const server=createApplicationServer({gateway,staticRoot:resolve(process.cwd(),'dist')})

server.listen(configuration.apiPort,configuration.apiHost,()=>{
 process.stdout.write(`CoSource listening on http://${configuration.apiHost}:${configuration.apiPort}\n`)
})

function shutdown(){server.close(()=>process.exit(0))}
process.on('SIGINT',shutdown)
process.on('SIGTERM',shutdown)
