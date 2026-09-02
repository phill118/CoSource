import type {GoalCondition} from './purchase-goal'

const operatorLabels={equals:'equals',at_most:'at most',at_least:'at least'} as const

export function formatGoalCondition(condition:GoalCondition):string{
 if(condition.operator==='free_text')return condition.value||'Incomplete condition'
 const field=condition.field||'Field'
 if(condition.operator==='is_true')return`${field} is required (true)`
 if(condition.operator==='is_false')return`${field} must be false (excluded)`
 return`${field} ${operatorLabels[condition.operator]} ${condition.value||'…'}`
}
