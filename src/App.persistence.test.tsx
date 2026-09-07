// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {createCoSourceApplication} from './application/cosource-application'
import type {PersistentApplication} from './application/persistence/persistent-application'
import type {PersistenceLifecycle} from './application/persistence/workspace-persistence'
import {createPersistentApplication} from './application/persistence/persistent-application'

const mocked=vi.hoisted(()=>({controller:undefined as PersistentApplication|undefined}))
vi.mock('./application/browser-application',()=>({createBrowserApplication:()=>mocked.controller!}))
import App from './App'

afterEach(()=>{cleanup();Reflect.deleteProperty(document,'modelContext')})
function controller(lifecycle:PersistenceLifecycle,retry=vi.fn()):PersistentApplication{const application=createCoSourceApplication({market:{country:'GB',currency:'GBP'},catalog:{search:async()=>({products:[],messages:[],pagination:{hasMore:false}}),product:async()=>{throw new Error('unused')}}});return{application,getPersistenceSnapshot:()=>lifecycle,subscribePersistence:()=>()=>{},initialize:async()=>{},retry}}
function show(lifecycle:PersistenceLifecycle,retry=vi.fn()){mocked.controller=controller(lifecycle,retry);return{view:render(<App/>),retry}}

describe('visible persistence lifecycle',()=>{
 it('gates controls while restoration is pending',()=>{show({status:'restoring'});expect(screen.getByRole('heading',{name:/Restoring your CoSource workspace/})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Search products'})).not.toBeInTheDocument()})
 it('gates corrupt storage and offers a non-destructive retry',()=>{const retry=vi.fn();show({status:'recovery_required',reason:'corrupt',access:'gated',message:'The saved workspace could not be safely validated.'},retry);expect(screen.getByRole('alert')).toHaveTextContent('It has not been changed or deleted.');fireEvent.click(screen.getByRole('button',{name:'Try restoration again'}));expect(retry).toHaveBeenCalledOnce()})
 it.each([
  [{status:'ready',lastSavedRevision:2,lastSavedAt:'2026-09-07T00:00:00.000Z'},/Saved locally/,'status'],
  [{status:'saving',durableRevision:3,lastSavedRevision:2},/Saving changes locally/,'status'],
  [{status:'conflict',durableRevision:3,storedRevision:4,message:'conflict'},/Save conflict/,'alert'],
 ] as const)('presents the %s state',(state,text,role)=>{show(state);expect(screen.getByRole(role)).toHaveTextContent(text)})
 it('makes memory-only recovery reachable without replacing the application',()=>{const retry=vi.fn();show({status:'unavailable',retryCapability:'supported',message:'Local persistence is temporarily unavailable; this workspace is memory-only.'},retry);expect(screen.getByRole('status')).toHaveTextContent('memory-only');fireEvent.click(screen.getByRole('button',{name:'Retry local storage'}));expect(retry).toHaveBeenCalledOnce()})
 it('withdraws the retry control while the shared retry operation is restoring',async()=>{let attempts=0,release!:(value:undefined)=>void;const pending=new Promise<undefined>(resolve=>{release=resolve}),application=controller({status:'restoring'}).application,persistent=createPersistentApplication(application,{load:()=>++attempts===1?Promise.reject(new Error('blocked')):pending,compareAndSave:async record=>({ok:true,record})});mocked.controller=persistent;render(<App/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Retry local storage'})).toBeInTheDocument());fireEvent.click(screen.getByRole('button',{name:'Retry local storage'}));await waitFor(()=>expect(screen.getByRole('heading',{name:/Restoring your CoSource workspace/})).toBeInTheDocument());expect(screen.queryByRole('button',{name:'Retry local storage'})).not.toBeInTheDocument();release(undefined);await waitFor(()=>expect(screen.queryByRole('heading',{name:/Restoring/})).not.toBeInTheDocument())})
 it('keeps a preserved memory workspace visible while recovery and WebMCP remain blocked',()=>{const retry=vi.fn();show({status:'recovery_required',reason:'corrupt',access:'memory_preserved',message:'Your current workspace is preserved in memory.'},retry);expect(screen.getByRole('alert')).toHaveTextContent('Workspace preserved in memory');expect(screen.getByRole('button',{name:'Search products'})).toBeInTheDocument();expect(screen.getByText('Agent tools unavailable')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Retry local storage'}));expect(retry).toHaveBeenCalledOnce()})
 it('presents save failure and retries the newest save',()=>{const retry=vi.fn();show({status:'save_error',durableRevision:3,message:'Changes could not be saved locally.'},retry);expect(screen.getByRole('alert')).toHaveTextContent('Changes are not safely stored.');fireEvent.click(screen.getByRole('button',{name:'Retry save'}));expect(retry).toHaveBeenCalledOnce()})
})
