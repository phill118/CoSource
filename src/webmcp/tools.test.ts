import {describe,expect,it,vi} from 'vitest'
import {createCoSourceApplication} from '../application/cosource-application'
import {COMMERCE_PROVIDERS,type ProductCluster} from '../commerce/domain/commerce'
import {createApplicationTools,registerApplicationTools,WEBMCP_TOOL_NAMES} from './application-tools'
const provider=COMMERCE_PROVIDERS.shopifyGlobalCatalog,provenance={kind:'provider_explicit' as const,provider},product:ProductCluster={identity:{provider,id:'a'},title:{value:'A',provenance},media:[],offers:[],offerCompleteness:'featured_only',provenance}
function app(){let n=0;const application=createCoSourceApplication({market:{country:'GB',currency:'GBP'},catalog:{search:async()=>({products:[product],messages:[],pagination:{hasMore:false}}),product:async()=>({product,selectedOptions:[],messages:[]})},makeId:()=>`id-${++n}`});application.editGoal({summary:'Buy A',searchFocus:'products'});return application}
const execute=async(name:string,input:unknown={})=>createApplicationTools(app()).find(tool=>tool.name===name)!.execute(input) as Promise<{ok:boolean;data?:Record<string,unknown>;error?:{code:string}}>
describe('application-backed WebMCP tools',()=>{
 it('registers all unique tools atomically',async()=>{const registered:WebMCPToolDefinition[]=[];const application=app(),controller=new AbortController();expect(await registerApplicationTools({registerTool:async tool=>{registered.push(tool)}},application,controller.signal)).toBe(11);expect(new Set(registered.map(tool=>tool.name)).size).toBe(11)})
 it('reads the validated goal',async()=>expect((await execute('get_purchase_goal')).ok).toBe(true))
 it('reads the live plan',async()=>expect((await execute('get_purchase_plan')).data).toMatchObject({revision:0}))
 it('evaluates the plan through the kernel',async()=>expect((await execute('evaluate_purchase_plan')).ok).toBe(true))
 it('lists retained evidence only after promotion',async()=>{const application=app();await application.searchCandidates({query:'products'});application.retainCandidate(product.identity);const tool=createApplicationTools(application).find(item=>item.name==='list_retained_products')!;expect(await tool.execute({})).toMatchObject({ok:true,data:{products:[{identity:product.identity}]}})})
 it('rejects invalid identities',async()=>expect((await execute('inspect_product',{product:{provider:'unsupported',id:'a'}})).error?.code).toBe('invalid_identity'))
 it('compares through the shared kernel',async()=>{const application=app(),second={...product,identity:{provider,id:'b'},title:{value:'B',provenance}};await application.searchCandidates({query:'products'});application.retainCandidate(product.identity);const unavailable=application.compareCandidates(product.identity,second.identity);expect(unavailable.ok).toBe(false)})
 it('contains no direct plan-application tool',()=>{expect(WEBMCP_TOOL_NAMES.join(' ')).not.toContain('apply_plan_changes');expect(vi.fn()).not.toHaveBeenCalled()})
})
