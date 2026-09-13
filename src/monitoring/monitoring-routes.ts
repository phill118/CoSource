import type {MonitoringFinding} from './domain/workspace-health'

export const monitoringRouteAnchors:Record<MonitoringFinding['route'],string>={commit_goal:'#stage-define',review_evidence:'#evidence-resolution',refresh_evidence:'#evidence-resolution',review_plan:'#stage-plan',review_supplier:'#supplier-intelligence',review_scenarios:'#scenario-planning',review_operation:'#supervised-operations',rebase_operation:'#supervised-operations',retry_persistence:'#persistence-status',inspect_persistence:'#persistence-status',inspect_webmcp:'#webmcp-status'}
