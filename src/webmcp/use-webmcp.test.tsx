// @vitest-environment jsdom
import { cleanup,renderHook,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it } from 'vitest'
import { createPurchasePlan } from '../planning/domain/purchase-plan'
import { useWebMCP } from './use-webmcp'

afterEach(()=>{cleanup();Reflect.deleteProperty(document,'modelContext')})
const state={plan:createPurchasePlan('plan','goal',0),retainedProducts:[]}

describe('WebMCP registration lifecycle',()=>{
  it('becomes ready only after all nine registrations succeed',async()=>{const signals:AbortSignal[]=[];const context=Object.assign(new EventTarget(),{async registerTool(_tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}){signals.push(options!.signal!)}});Object.defineProperty(document,'modelContext',{configurable:true,value:context});const view=renderHook(()=>useWebMCP(state));await waitFor(()=>expect(view.result.current).toMatchObject({status:'ready',toolCount:9}));expect(signals).toHaveLength(9);view.unmount();expect(signals.every(signal=>signal.aborted)).toBe(true)})
  it('atomically aborts earlier registrations and reports zero tools when one fails',async()=>{const registrations:Array<{name:string;signal:AbortSignal}>=[];const context=Object.assign(new EventTarget(),{async registerTool(tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}){registrations.push({name:tool.name,signal:options!.signal!});if(tool.name==='evaluate_purchase_plan')throw new Error('intentional registration failure')}});Object.defineProperty(document,'modelContext',{configurable:true,value:context});const view=renderHook(()=>useWebMCP(state));await waitFor(()=>expect(view.result.current.status).toBe('error'));expect(view.result.current.toolCount).toBe(0);expect(registrations.length).toBeGreaterThan(1);expect(new Set(registrations.map(item=>item.signal)).size).toBe(1);expect(registrations.every(item=>item.signal.aborted)).toBe(true);view.unmount()})
  it('does not publish ready or error after unmount during pending registration',async()=>{let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve}),signals:AbortSignal[]=[];const context=Object.assign(new EventTarget(),{async registerTool(_tool:WebMCPToolDefinition,options?:{signal?:AbortSignal}){signals.push(options!.signal!);await pending}});Object.defineProperty(document,'modelContext',{configurable:true,value:context});const view=renderHook(()=>useWebMCP(state));expect(view.result.current.status).toBe('registering');view.unmount();expect(signals.every(signal=>signal.aborted)).toBe(true);release();await pending})
})
