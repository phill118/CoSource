import type { WebMCPActivity } from './types'
import type { WebMCPStatus } from './use-webmcp'
import './webmcp.css'

const labels:Record<WebMCPStatus,string>={unavailable:'WebMCP unavailable in this browser',registering:'WebMCP tools registering',ready:'WebMCP ready',error:'WebMCP registration unavailable'}
export function WebMCPStatusPanel({status,toolCount,activities}:{status:WebMCPStatus;toolCount:number;activities:WebMCPActivity[]}){return <aside className="webmcp-status" aria-labelledby="webmcp-title"><div><p className="eyebrow">Agent tools</p><h2 id="webmcp-title">{labels[status]}</h2><p>{status==='ready'?`${toolCount} read-only tools available. No agent connection is implied.`:'The human workspace continues to work normally.'}</p></div><div><h3>Recent tool activity</h3>{activities.length?<ol>{activities.map(activity=><li key={activity.id}><time dateTime={activity.timestamp}>{new Date(activity.timestamp).toLocaleTimeString()}</time><strong>{activity.toolName}</strong><span>{activity.outcome}: {activity.summary}</span></li>)}</ol>:<p className="muted">No tool calls this session.</p>}</div></aside>}
