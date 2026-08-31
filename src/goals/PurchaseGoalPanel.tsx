import { useState } from 'react'
import './PurchaseGoalPanel.css'
import { parseMoneyInput } from '../commerce/domain/money-input'
import { formatMoney } from '../commerce/domain/money-display'
import type { GoalCondition, GoalConditionKind, PurchaseGoalDraft } from './domain/purchase-goal'
import { validatePurchaseGoal } from './domain/purchase-goal'

interface Props {
  goal: PurchaseGoalDraft
  edit: (changes: Partial<Omit<PurchaseGoalDraft, 'state' | 'id' | 'revision'>>) => void
  addCondition: (kind: GoalConditionKind) => void
  editCondition: (kind: GoalConditionKind, id: string, changes: Partial<GoalCondition>) => void
  removeCondition: (kind: GoalConditionKind, id: string) => void
  useSummary: () => void
}

const groups: Array<{ kind: GoalConditionKind; key: 'requirements'|'preferences'|'exclusions'; title: string; add: string }> = [
  { kind: 'requirement', key: 'requirements', title: 'Must have', add: 'Add hard requirement' },
  { kind: 'preference', key: 'preferences', title: 'Prefer', add: 'Add preference' },
  { kind: 'exclusion', key: 'exclusions', title: 'Exclude', add: 'Add exclusion' },
]
const operatorLabels = { free_text: 'Free text', equals: 'Equals', is_true: 'Is true', is_false: 'Is false', at_most: 'At most', at_least: 'At least' }
const supportedCurrencies = Intl.supportedValuesOf('currency')

function conditionText(condition: GoalCondition) {
  if (condition.operator === 'free_text') return condition.value || 'Incomplete condition'
  if (condition.operator === 'is_true') return `${condition.field || 'Field'} is required`
  if (condition.operator === 'is_false') return `${condition.field || 'Field'} must be false`
  return `${condition.field || 'Field'} ${operatorLabels[condition.operator].toLowerCase()} ${condition.value || '…'}`
}

export function PurchaseGoalPanel(props: Props) {
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState('GBP')
  const [budgetError, setBudgetError] = useState('')
  const validation = validatePurchaseGoal(props.goal)

  function updateBudget(amount: string, currency: string) {
    setBudgetAmount(amount); setBudgetCurrency(currency)
    if (!amount) { setBudgetError(''); props.edit({ budget: undefined }); return }
    try {
      props.edit({ budget: parseMoneyInput(amount, currency) }); setBudgetError('')
    } catch { setBudgetError('Enter a valid amount for a supported currency.'); props.edit({ budget: undefined }) }
  }

  return <section className="goal-section" aria-labelledby="goal-title"><div className="goal-intro"><p className="eyebrow">1 · Define what you need</p><h2 id="goal-title">Purchase goal</h2><p>Describe your intent explicitly. CoSource stores what you enter—it does not yet judge whether products satisfy it.</p></div>
    <div className="goal-layout"><div className="goal-editor">
      <label htmlFor="goal-summary">What are you trying to buy or achieve?</label><textarea id="goal-summary" value={props.goal.summary} maxLength={1000} onChange={(event) => props.edit({ summary: event.target.value })} placeholder="For example: office chairs for a shared workspace" aria-describedby="goal-summary-help"/><p id="goal-summary-help" className="field-help">Required, up to 1,000 characters. Your words are not interpreted or enriched.</p>
      <div className="goal-basics"><div><label htmlFor="goal-quantity">Quantity <span>optional</span></label><input id="goal-quantity" type="number" min="1" max="100000" value={props.goal.quantity ?? ''} onChange={(event) => props.edit({ quantity: event.target.value ? Number(event.target.value) : undefined })}/></div><fieldset><legend>Budget <span>optional</span></legend><div className="budget-row"><label><span>Amount</span><input aria-label="Budget amount" inputMode="decimal" value={budgetAmount} onChange={(event) => updateBudget(event.target.value, budgetCurrency)} placeholder="800.00"/></label><label><span>Currency</span><input aria-label="Budget currency" list="supported-currencies" maxLength={3} value={budgetCurrency} onChange={(event) => updateBudget(budgetAmount, event.target.value.toUpperCase())}/><datalist id="supported-currencies">{supportedCurrencies.map((currency) => <option key={currency} value={currency}/>)}</datalist></label></div>{budgetError && <p className="validation" role="alert">{budgetError}</p>}</fieldset></div>
      {groups.map((group) => <fieldset className="condition-group" key={group.kind}><legend>{group.title}</legend>{props.goal[group.key].map((condition, index) => <div className="condition-row" key={condition.id}>
        <label><span>Operator</span><select aria-label={`${group.title} ${index + 1} operator`} value={condition.operator} onChange={(event) => props.editCondition(group.kind, condition.id, { operator: event.target.value as GoalCondition['operator'], field: undefined, value: '' })}>{Object.entries(operatorLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {condition.operator !== 'free_text' && <label><span>Field</span><input aria-label={`${group.title} ${index + 1} field`} value={condition.field ?? ''} maxLength={100} onChange={(event) => props.editCondition(group.kind, condition.id, { field: event.target.value })}/></label>}
        {!['is_true','is_false'].includes(condition.operator) && <label className="condition-value"><span>{condition.operator === 'free_text' ? 'Condition' : 'Value'}</span><input aria-label={`${group.title} ${index + 1} value`} value={condition.value ?? ''} maxLength={500} onChange={(event) => props.editCondition(group.kind, condition.id, { value: event.target.value })}/></label>}
        <button type="button" className="remove" aria-label={`Remove ${group.kind} ${index + 1}`} onClick={() => props.removeCondition(group.kind, condition.id)}>Remove</button>
      </div>)}<button type="button" className="secondary add-condition" onClick={() => props.addCondition(group.kind)}>{group.add}</button></fieldset>)}
    </div><aside className="goal-preview" aria-labelledby="preview-title" aria-live="polite"><div className="preview-head"><h3 id="preview-title">Structured goal</h3><span>Revision {props.goal.revision}</span></div>{props.goal.summary ? <><strong className="goal-summary">{props.goal.quantity ? `${props.goal.quantity} × ` : ''}{props.goal.summary}</strong>{props.goal.budget && <p><span>Budget</span><strong>{formatMoney(props.goal.budget)}</strong></p>}{groups.map((group) => <div key={group.kind}><h4>{group.title}</h4>{props.goal[group.key].length ? <ul>{props.goal[group.key].map((condition) => <li key={condition.id}>{conditionText(condition)}</li>)}</ul> : <p className="muted">None entered</p>}</div>)}<button type="button" className="secondary" onClick={props.useSummary}>Use goal summary as search</button></> : <p className="muted">Enter a summary to create a valid structured goal.</p>}{!validation.success && props.goal.summary && <p className="validation" role="alert">Some goal fields are incomplete or invalid.</p>}</aside></div>
  </section>
}
