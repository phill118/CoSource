import { useCallback, useEffect, useRef, useState } from 'react'
import { registerReadTools } from './tools'
import type { WebMCPActivity, WebMCPState } from './types'

export type WebMCPStatus='unavailable'|'registering'|'ready'|'error'
export function useWebMCP(state:WebMCPState){
  const stateRef=useRef(state),nextId=useRef(1)
  const [status,setStatus]=useState<WebMCPStatus>(()=>document.modelContext?'registering':'unavailable')
  const [toolCount,setToolCount]=useState(0),[activities,setActivities]=useState<WebMCPActivity[]>([])
  useEffect(()=>{stateRef.current=state},[state])
  const record=useCallback((activity:Omit<WebMCPActivity,'id'|'timestamp'>)=>setActivities(current=>[{...activity,id:nextId.current++,timestamp:new Date().toISOString()},...current].slice(0,20)),[])
  useEffect(()=>{const modelContext=document.modelContext;if(!modelContext)return;const controller=new AbortController();void registerReadTools(modelContext,()=>stateRef.current,record,controller.signal).then(count=>{if(!controller.signal.aborted){setToolCount(count);setStatus('ready')}}).catch(()=>{if(controller.signal.aborted)return;controller.abort();setToolCount(0);setStatus('error')});return()=>controller.abort()},[record])
  return{status,toolCount,activities}
}
