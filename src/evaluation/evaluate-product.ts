import type { MerchantOffer, ProvenanceKind, ProductCluster } from '../commerce/domain/commerce'
import type { GoalCondition, GoalConditionKind, PurchaseGoal } from '../goals/domain/purchase-goal'
import type { BudgetEvaluation, ConditionEvaluation, EvaluationEvidence, EvaluationProduct, EvaluationStatus, ProductEvaluation } from './domain/product-evaluation'

interface ResolvedValue { field: string; value: string; provenance: ProvenanceKind }
const normalise = (value: string) => value.trim().toLocaleLowerCase('en-US')
const evidencePriority: Record<ProvenanceKind, number> = { provider_explicit: 4, cosource_derived: 3, provider_inferred: 2, unknown: 1 }

function strongest<T extends { value: ResolvedValue }>(entries: T[]): T[] {
  const priority = Math.max(...entries.map((entry) => evidencePriority[entry.value.provenance]))
  return entries.filter((entry) => evidencePriority[entry.value.provenance] === priority)
}

function conflict(condition: GoalCondition, kind: GoalConditionKind, values: ResolvedValue[]): ConditionEvaluation {
  const observed = values[0]!
  return unknown(condition, kind, `Equally strong evidence for "${observed.field}" conflicts, so no unique result can be established.`, { kind: observed.provenance, field: observed.field, value: values.map((value) => value.value).join(' / ') })
}

function resolveField(product: EvaluationProduct, field: string, offer?: MerchantOffer): ResolvedValue[] {
  const key = normalise(field); const values: ResolvedValue[] = []
  for (const attribute of product.attributes?.value ?? []) if (normalise(attribute.name) === key) values.push({ field: attribute.name, value: attribute.value, provenance: product.attributes!.provenance.kind })
  for (const option of product.options?.value ?? []) if (normalise(option.name) === key) for (const value of option.values) values.push({ field: option.name, value: value.value, provenance: product.options!.provenance.kind })
  for (const option of offer?.selectedOptions ?? []) if (normalise(option.name) === key) values.push({ field: option.name, value: option.value, provenance: offer!.provenance.kind })
  return values
}

const unknown = (condition: GoalCondition, kind: GoalConditionKind, reason: string, evidence: EvaluationEvidence = { kind: 'unknown' }): ConditionEvaluation => ({ conditionId: condition.id, kind, condition, status: 'unknown', evidence, reason })
function result(condition: GoalCondition, kind: GoalConditionKind, status: EvaluationStatus, value: ResolvedValue, reason: string): ConditionEvaluation {
  if (value.provenance !== 'provider_explicit' && value.provenance !== 'cosource_derived') return unknown(condition, kind, `Only inferred evidence was returned for "${value.field}"; verification is required.`, { kind: value.provenance, field: value.field, value: value.value })
  return { conditionId: condition.id, kind, condition, status, evidence: { kind: value.provenance, field: value.field, value: value.value }, reason }
}

function parseBoolean(value: string): boolean | undefined { const text = normalise(value); if (text === 'true' || text === 'yes') return true; if (text === 'false' || text === 'no') return false; return undefined }
function parseNumber(value: string): { number: number; unit?: string } | undefined {
  const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s+([^\d\s].*))?$/.exec(value.trim())
  if (!match) return undefined
  const number = Number(match[1]); return Number.isFinite(number) ? { number, unit: match[2] ? normalise(match[2]) : undefined } : undefined
}

function evaluateCondition(condition: GoalCondition, kind: GoalConditionKind, product: EvaluationProduct, offer?: MerchantOffer): ConditionEvaluation {
  if (condition.operator === 'free_text') return unknown(condition, kind, 'Free-text intent has no structured field and is not interpreted automatically.')
  const values = resolveField(product, condition.field ?? '', offer)
  if (!values.length) return unknown(condition, kind, `No structured evidence for "${condition.field}" was returned.`)
  if (condition.operator === 'equals') {
    const candidates = strongest(values.map((value) => ({ value }))).map((entry) => entry.value)
    if (new Set(candidates.map((value) => normalise(value.value))).size > 1) return conflict(condition, kind, candidates)
    const observed = candidates[0]!; const match = normalise(observed.value) === normalise(condition.value ?? '')
    const status = match ? 'satisfied' : 'failed'; const base = `Provided field "${observed.field}" is "${observed.value}".`
    return result(condition, kind, kind === 'exclusion' ? (status === 'satisfied' ? 'failed' : 'satisfied') : status, observed, kind === 'exclusion' && match ? `${base} The exclusion is violated.` : base)
  }
  if (condition.operator === 'is_true' || condition.operator === 'is_false') {
    const expected = condition.operator === 'is_true'; const candidates = strongest(values.map((value) => ({ value }))); const parsedValues = candidates.map((entry) => ({ value: entry.value, boolean: parseBoolean(entry.value.value) }))
    const parsed = parsedValues.find((entry) => entry.boolean !== undefined)
    if (!parsed || parsedValues.some((entry) => entry.boolean === undefined)) return unknown(condition, kind, `Strongest evidence for "${condition.field}" is not an unambiguous boolean.`, { kind: candidates[0]!.value.provenance, field: candidates[0]!.value.field, value: candidates.map((entry) => entry.value.value).join(' / ') })
    if (new Set(parsedValues.map((entry) => entry.boolean)).size > 1) return conflict(condition, kind, candidates.map((entry) => entry.value))
    const matches = parsed.boolean === expected; const status = kind === 'exclusion' ? (matches ? 'failed' : 'satisfied') : (matches ? 'satisfied' : 'failed')
    return result(condition, kind, status, parsed.value, `Provided field "${parsed.value.field}" is "${parsed.value.value}".${kind === 'exclusion' && matches ? ' The exclusion is violated.' : ''}`)
  }
  const expected = parseNumber(condition.value ?? ''); const candidates = values.map((value) => ({ value, parsed: parseNumber(value.value) })).filter((entry): entry is { value: ResolvedValue; parsed: { number: number; unit?: string } } => Boolean(entry.parsed))
  if (!expected || !candidates.length) return unknown(condition, kind, `Structured evidence for "${condition.field}" is not an unambiguous number.`)
  const compatibleCandidates = candidates.filter((entry) => entry.parsed.unit === expected.unit)
  if (!compatibleCandidates.length) return unknown(condition, kind, `Units for "${condition.field}" are absent or incompatible.`)
  const strongestCompatible = strongest(compatibleCandidates)
  if (new Set(strongestCompatible.map((entry) => entry.parsed.number)).size > 1) return conflict(condition, kind, strongestCompatible.map((entry) => entry.value))
  const compatible = strongestCompatible[0]!
  const meets = condition.operator === 'at_least' ? compatible.parsed.number >= expected.number : compatible.parsed.number <= expected.number
  const status = kind === 'exclusion' ? (meets ? 'failed' : 'satisfied') : (meets ? 'satisfied' : 'failed')
  return result(condition, kind, status, compatible.value, `Provided field "${compatible.value.field}" is "${compatible.value.value}" and was compared without unit conversion.${kind === 'exclusion' && meets ? ' The exclusion is violated.' : ''}`)
}

function evaluateBudget(goal: PurchaseGoal, offer?: MerchantOffer): BudgetEvaluation | undefined {
  if (!goal.budget) return undefined
  if (!offer) return { status: 'unknown', evidence: { kind: 'unknown' }, reason: 'No single merchant offer was selected for item-price budget evaluation.' }
  if (offer.price.currency !== goal.budget.currency) return { status: 'unknown', evidence: { kind: 'unknown', value: `${offer.price.currency} ${offer.price.minorAmount}` }, itemPrice: offer.price, reason: `Returned currency ${offer.price.currency} cannot be compared with goal budget ${goal.budget.currency} without FX data.` }
  if (goal.quantity && goal.quantity > 1) return { status: 'unknown', evidence: { kind: offer.provenance.kind, value: String(offer.price.minorAmount) }, itemPrice: offer.price, reason: 'Quantity is greater than one, but per-unit or pack semantics are not established; item-price subtotal was not derived.' }
  const status = offer.price.minorAmount <= goal.budget.minorAmount ? 'satisfied' : 'failed'
  return { status, evidence: { kind: 'cosource_derived', value: String(offer.price.minorAmount) }, itemPrice: offer.price, reason: `Same-currency item price was compared with the goal budget. This excludes shipping and tax and is not a final total.` }
}

export function evaluateProductAgainstGoal(goal: PurchaseGoal, product: ProductCluster, offer?: MerchantOffer): ProductEvaluation {
  const requirements = goal.requirements.map((condition) => evaluateCondition(condition, 'requirement', product, offer))
  const preferences = goal.preferences.map((condition) => evaluateCondition(condition, 'preference', product, offer))
  const exclusions = goal.exclusions.map((condition) => evaluateCondition(condition, 'exclusion', product, offer))
  const budget = evaluateBudget(goal, offer)
  const mandatory = [...requirements, ...exclusions]; const mandatoryStatuses = [...mandatory.map((item) => item.status), ...(budget ? [budget.status] : [])]
  const eligibility = mandatoryStatuses.includes('failed') ? 'ineligible' : mandatoryStatuses.includes('unknown') ? 'eligible_with_unknowns' : 'eligible'
  const all = [...mandatory, ...preferences]; const counts = { satisfied: all.filter((item) => item.status === 'satisfied').length, failed: all.filter((item) => item.status === 'failed').length, unknown: all.filter((item) => item.status === 'unknown').length }
  return { goalId: goal.id, goalRevision: goal.revision, productId: product.identity.id, eligibility, requirements, preferences, exclusions, budget, counts }
}
