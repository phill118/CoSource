import { useState } from 'react'
import type { GoalCondition, GoalConditionKind, PurchaseGoalDraft } from './domain/purchase-goal'
import { createPurchaseGoalDraft, revisePurchaseGoalDraft } from './domain/purchase-goal'

const collectionFor = { requirement: 'requirements', preference: 'preferences', exclusion: 'exclusions' } as const
const identity = () => globalThis.crypto?.randomUUID?.() ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function usePurchaseGoal() {
  const [goal, setGoal] = useState<PurchaseGoalDraft>(() => createPurchaseGoalDraft(identity()))
  const edit = (changes: Partial<Omit<PurchaseGoalDraft, 'state' | 'id' | 'revision'>>) => setGoal((current) => revisePurchaseGoalDraft(current, changes))
  const addCondition = (kind: GoalConditionKind) => setGoal((current) => {
    const key = collectionFor[kind]; return revisePurchaseGoalDraft(current, { [key]: [...current[key], { id: identity(), operator: 'free_text', value: '' }] })
  })
  const editCondition = (kind: GoalConditionKind, id: string, changes: Partial<GoalCondition>) => setGoal((current) => {
    const key = collectionFor[kind]; return revisePurchaseGoalDraft(current, { [key]: current[key].map((condition) => condition.id === id ? { ...condition, ...changes } : condition) })
  })
  const removeCondition = (kind: GoalConditionKind, id: string) => setGoal((current) => {
    const key = collectionFor[kind]; return revisePurchaseGoalDraft(current, { [key]: current[key].filter((condition) => condition.id !== id) })
  })
  return { goal, edit, addCondition, editCondition, removeCondition }
}
