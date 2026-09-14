// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {afterEach,describe,expect,it,vi} from 'vitest'
import type {ProjectPortfolio,PortfolioSnapshot} from './project-portfolio-controller'
import {ProjectControls} from './ProjectControls'

afterEach(cleanup)
const metadata=(id:string,name:string)=>({id,name,createdAt:'2026-09-07T00:00:00.000Z',updatedAt:'2026-09-07T00:00:00.000Z'})
function portfolio(){return{createProject:vi.fn(async()=>({ok:true as const})),renameActiveProject:vi.fn(async()=>({ok:true as const})),switchProject:vi.fn(async()=>({ok:true as const}))} as unknown as ProjectPortfolio}
const snapshot=(status:'ready'|'conflict'='ready')=>({status,...(status==='conflict'?{message:'The saved project list changed elsewhere. Reload to reconcile it safely.'}:{}),directory:{formatVersion:1,directoryRevision:1,activeProjectId:'a',projects:[metadata('a','Alpha'),metadata('b','Beta')]}} as PortfolioSnapshot)

describe('project controls',()=>{
 it('keeps secondary management behind a keyboard-operable disclosure',()=>{render(<ProjectControls portfolio={portfolio()} snapshot={snapshot()}/>);const disclosure=screen.getByText('Manage projects');expect(disclosure.tagName).toBe('SUMMARY');expect(screen.getByRole('button',{name:'Create project'})).not.toBeVisible();fireEvent.click(disclosure);expect(screen.getByRole('button',{name:'Create project'})).toBeVisible();expect(screen.getByRole('button',{name:'Rename'})).toBeVisible()})
 it('preserves canonical create, rename, and switch actions after deliberate expansion',()=>{const owner=portfolio();render(<ProjectControls portfolio={owner} snapshot={snapshot()}/>);fireEvent.change(screen.getByLabelText('Project'),{target:{value:'b'}});fireEvent.click(screen.getByText('Manage projects'));fireEvent.change(screen.getByLabelText('New project name'),{target:{value:'Gamma'}});fireEvent.submit(screen.getByLabelText('New project name').closest('form')!);fireEvent.change(screen.getByLabelText('Rename active project'),{target:{value:'Annual'}});fireEvent.submit(screen.getByLabelText('Rename active project').closest('form')!);expect(owner.switchProject).toHaveBeenCalledWith('b');expect(owner.createProject).toHaveBeenCalledWith('Gamma');expect(owner.renameActiveProject).toHaveBeenCalledWith('Annual')})
 it('shows honest memory-only status without ineffective controls',()=>{render(<ProjectControls portfolio={portfolio()} snapshot={{status:'unavailable',message:'Saved projects require local browser storage.'}}/>);expect(screen.getByText('Memory-only workspace')).toBeInTheDocument();expect(screen.queryByRole('button')).not.toBeInTheDocument()})
 it('shows canonical conflict feedback and keeps disclosed mutations disabled',()=>{render(<ProjectControls portfolio={portfolio()} snapshot={snapshot('conflict')}/>);expect(screen.getByRole('alert')).toHaveTextContent('changed elsewhere');fireEvent.click(screen.getByText('Manage projects'));expect(screen.getByRole('button',{name:'Create project'})).toBeDisabled();expect(screen.getByRole('button',{name:'Rename'})).toBeDisabled()})
})
