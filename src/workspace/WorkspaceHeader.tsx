import type {ReactNode} from 'react'
import type {CoSourceSessionState,GoalCommitmentStatus} from '../application/cosource-application'
import type {WebMCPStatus} from '../webmcp/use-webmcp'
import {deriveJourneySteps,type JourneyStepId} from './journey'
import './WorkspaceHeader.css'

const webmcpLabels:Record<WebMCPStatus,string>={unavailable:'WebMCP unavailable in this browser',registering:'Agent tools connecting',ready:'WebMCP ready',error:'WebMCP registration failed'}
export type WorkspaceView='overview'|JourneyStepId|'intelligence'

export function WorkspaceHeader({state,webmcp,toolCount,projectControls,persistenceStatus}:{state:CoSourceSessionState;commitment:GoalCommitmentStatus;webmcp:WebMCPStatus;toolCount:number;projectControls?:ReactNode;persistenceStatus?:ReactNode}){
 return <header className="product-header"><div className="product-brand"><a href="/" aria-label="CoSource Purchasing home">CoSource</a><span>Procurement intelligence</span></div>{projectControls}<div className="header-context" aria-label="Global workspace context"><span>{state.market.country} / {state.market.currency}</span>{persistenceStatus}<span className={`readiness readiness-${webmcp}`}><span>{webmcpLabels[webmcp]}</span>{webmcp==='ready'&&<b>{toolCount} registered WebMCP tools</b>}</span></div></header>
}

export function WorkspaceNavigation({state,activeView,onNavigate}:{state:CoSourceSessionState;activeView:WorkspaceView;onNavigate:(view:WorkspaceView,href:string)=>void}){
 const steps=deriveJourneySteps(state),items=[{id:'overview' as const,label:'Overview',state:'ready' as const,href:'#workspace-overview'},...steps.map(step=>({...step,href:`#stage-${step.id}`})),{id:'intelligence' as const,label:'Decision intelligence',state:'waiting' as const,href:'#decision-intelligence'}]
 return <nav className="journey-nav" aria-label="Workspace navigation"><ol>{items.map(item=><li key={item.id} data-state={item.state}><a href={item.href} aria-label={item.label} aria-current={activeView===item.id?'page':undefined} onClick={()=>onNavigate(item.id,item.href)}><span aria-hidden="true"/><strong>{item.label}</strong>{'hint'in item&&<small>{item.hint}</small>}</a></li>)}</ol></nav>
}
