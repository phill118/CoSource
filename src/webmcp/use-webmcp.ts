import { useCallback, useEffect, useRef, useState } from 'react'
import { registerWebMCPTools } from './tools'
import type { WebMCPActivity, WebMCPState } from './types'
import type { PlanChangeProposal } from '../proposals/domain/plan-change-proposal'

export type WebMCPStatus='unavailable'|'registering'|'ready'|'error'
export function useWebMCP(state:WebMCPState,onProposal:(proposal:PlanChangeProposal)=>void=()=>undefined){
  const stateRef=useRef(state),nextId=useRef(1)
  const [status,setStatus]=useState<WebMCPStatus>(()=>document.modelContext?'registering':'unavailable')
  const [toolCount,setToolCount]=useState(0),[activities,setActivities]=useState<WebMCPActivity[]>([])
  useEffect(()=>{stateRef.current=state},[state])
  const record=useCallback((activity:Omit<WebMCPActivity,'id'|'timestamp'>)=>setActivities(current=>[{...activity,id:nextId.current++,timestamp:new Date().toISOString()},...current].slice(0,20)),[])
  const proposalRef=useRef(onProposal);useEffect(()=>{proposalRef.current=onProposal},[onProposal])
  useEffect(()=>{const modelContext=document.modelContext;if(!modelContext)return;const controller=new AbortController();void registerWebMCPTools(modelContext,()=>stateRef.current,proposal=>proposalRef.current(proposal),record,controller.signal).then(count=>{if(!controller.signal.aborted){setToolCount(count);setStatus('ready')}}).catch(()=>{if(controller.signal.aborted)return;controller.abort();setToolCount(0);setStatus('error')});return()=>controller.abort()},[record])
  return{status,toolCount,activities,recordActivity:record}
}
