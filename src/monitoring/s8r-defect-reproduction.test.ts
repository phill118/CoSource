import {describe,expect,it,vi} from 'vitest'
import {createCoSourceApplication} from '../application/cosource-application'
import {composeWorkspaceHealth,projectWorkspaceHealth,type MonitoringRuntimeFacts} from './domain/workspace-health'
import {monitoringRouteAnchors} from './monitoring-routes'

const at='2026-09-12T12:00:00.000Z'
const input={workspaceId:'workspace',activeGoal:{id:'goal',revision:1},draftDiverged:false,plan:{id:'plan',revision:1,lineCount:0},issues:[],operations:[],evaluatedAt:at}
const webmcp={status:'ready' as const,toolCount:13,requiredToolCount:13 as const}

describe('S8R monitoring composition regressions',()=>{
 it('captures the application clock exactly once for a complete health calculation',()=>{let calls=0;const now=vi.fn(()=>{calls++;return calls===1?at:'2026-09-13T12:00:00.000Z'}),application=createCoSourceApplication({market:{country:'GB',currency:'GBP'},now,makeId:()=> 'id',catalog:{search:async()=>({products:[],messages:[],pagination:{hasMore:false}}),product:vi.fn()}});application.editGoal({summary:'Buy products',searchFocus:'products'});application.commitGoalDraft();calls=0;now.mockClear();const health=application.getWorkspaceHealth();expect(now).toHaveBeenCalledOnce();expect(health.evaluatedAt).toBe(at)})
 it.each([
  [{status:'ready',retrySupported:false},undefined,'attention_required'],
  [{status:'saving',retrySupported:false},undefined,'attention_required'],
  [{status:'save_error',retrySupported:true,message:'Save failed'},'executable','blocked'],
  [{status:'conflict',retrySupported:false,message:'Memory preserved'},'informational','blocked'],
  [{status:'unavailable',retrySupported:true,message:'Storage unavailable'},'executable','unavailable'],
  [{status:'unavailable',retrySupported:false,message:'Unsupported'},'informational','unavailable'],
  [{status:'recovery_required',retrySupported:true,message:'Recovery required',access:'memory_preserved'},'executable','unavailable'],
 ] as const)('canonically composes persistence lifecycle %o',(persistence,routeKind,status)=>{const result=composeWorkspaceHealth(projectWorkspaceHealth(input),{persistence,webmcp} as MonitoringRuntimeFacts),finding=result.findings.find(item=>item.owner==='persistence');expect(finding?.routeKind).toBe(routeKind);expect(result.status).toBe(status);expect(result.highestPriorityReason).toBe(result.findings[0]?.reason);expect(result.findings.filter(item=>item.owner==='persistence')).toHaveLength(routeKind?1:0)})
 it('preserves independent runtime failures while suppressing goal-dependent noise',()=>{const project=projectWorkspaceHealth({...input,activeGoal:undefined}),result=composeWorkspaceHealth(project,{persistence:{status:'ready',retrySupported:false},webmcp:{status:'error',toolCount:0,requiredToolCount:13}});expect(result.findings.map(item=>item.owner)).toEqual(['webmcp','goal']);expect(result.findings.filter(item=>item.owner==='plan')).toHaveLength(0)})
 it('maps every closed route to a bounded existing page destination',()=>{expect(monitoringRouteAnchors).toEqual({commit_goal:'#stage-define',review_evidence:'#evidence-resolution',refresh_evidence:'#evidence-resolution',review_plan:'#stage-plan',review_supplier:'#supplier-intelligence',review_scenarios:'#scenario-planning',review_operation:'#supervised-operations',rebase_operation:'#supervised-operations',retry_persistence:'#persistence-status',inspect_persistence:'#persistence-status',inspect_webmcp:'#webmcp-status'})})
})
