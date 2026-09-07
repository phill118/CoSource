import { useEffect, useState } from 'react'
import { registerApplicationTools } from './application-tools'
import type {CoSourceApplication} from '../application/cosource-application'

export type WebMCPStatus='unavailable'|'registering'|'ready'|'error'
export function useWebMCP(application:CoSourceApplication,enabled=true){
  const [status,setStatus]=useState<WebMCPStatus>(()=>enabled&&document.modelContext?'registering':'unavailable')
  const [toolCount,setToolCount]=useState(0)
  useEffect(()=>{if(!enabled)return;const modelContext=document.modelContext;if(!modelContext)return;const controller=new AbortController();void registerApplicationTools(modelContext,application,controller.signal).then(count=>{if(!controller.signal.aborted){setToolCount(count);setStatus('ready')}}).catch(()=>{if(controller.signal.aborted)return;controller.abort();setToolCount(0);setStatus('error')});return()=>controller.abort()},[application,enabled])
  return enabled?{status,toolCount}:{status:'unavailable' as const,toolCount:0}
}
