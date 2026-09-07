import {useState} from 'react'
import type {PortfolioSnapshot,ProjectPortfolio} from './project-portfolio-controller'

export function ProjectControls({portfolio,snapshot}:{portfolio:ProjectPortfolio;snapshot:PortfolioSnapshot}){
 const directory=snapshot.directory,active=directory?.projects.find(project=>project.id===directory.activeProjectId)
 const [newName,setNewName]=useState(''),[rename,setRename]=useState(active?.name??''),[feedback,setFeedback]=useState('')
 if(!directory||!active)return <section className="project-controls memory-only"><strong>Memory-only workspace</strong><span>{snapshot.message}</span></section>
 const busy=Boolean(snapshot.operation),locked=snapshot.status!=='ready'
 const act=async(operation:Promise<{ok:boolean;message?:string}>)=>{const result=await operation;setFeedback(result.ok?'Saved locally':result.message??'Project operation failed.');return result.ok}
 return <section className="project-controls" aria-label="Saved projects">
  <div><span className="eyebrow">Active project</span><strong>{active.name}</strong><small>{directory.projects.length} of 50 saved locally</small></div>
  {directory.projects.length>1&&<label>Project<select value={directory.activeProjectId} disabled={busy||locked} onChange={event=>void act(portfolio.switchProject(event.target.value))}>{directory.projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
  <form onSubmit={event=>{event.preventDefault();void act(portfolio.createProject(newName)).then(ok=>{if(ok)setNewName('')})}}><label htmlFor="new-project-name">New project name</label><div><input id="new-project-name" value={newName} maxLength={100} disabled={busy||locked} onChange={event=>setNewName(event.target.value)}/><button disabled={busy||locked}>Create project</button></div></form>
  <form onSubmit={event=>{event.preventDefault();void act(portfolio.renameActiveProject(rename))}}><label htmlFor="rename-project">Rename active project</label><div><input id="rename-project" value={rename} maxLength={100} disabled={busy||locked} onChange={event=>setRename(event.target.value)}/><button className="secondary" disabled={busy||locked}>Rename</button></div></form>
  {snapshot.message&&<span role={snapshot.status==='conflict'?'alert':'status'}>{snapshot.message}</span>}{feedback&&snapshot.status==='ready'&&<span role="status">{feedback}</span>}
 </section>
}
